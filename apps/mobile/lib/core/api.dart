import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';

class ApiException implements Exception {
  ApiException(this.status, this.message);
  final int status;
  final String message;
  @override
  String toString() => message;
}

class ApiClient extends ChangeNotifier {
  ApiClient({required this.baseUrl, http.Client? client, FlutterSecureStorage? storage})
      : _client = client ?? http.Client(),
        _storage = storage ?? const FlutterSecureStorage();

  final String baseUrl;
  final http.Client _client;
  final FlutterSecureStorage _storage;
  String? _accessToken;
  String? _refreshToken;
  Map<String, dynamic>? user;
  bool get signedIn => _accessToken != null;
  bool restoring = false;
  String? sessionError;
  String? sessionMessage;
  int _generation = 0;
  Future<void>? _renewal;
  Future<void> _storageWrites = Future.value();

  Future<void> restore() async {
    if (restoring) return;
    final generation = _generation;
    restoring = true;
    sessionError = null;
    notifyListeners();
    try {
      final saved = await _storage.read(key: 'refreshToken');
      if (generation != _generation) return;
      _refreshToken ??= saved;
      if (_refreshToken == null) return;
      if (_accessToken == null) await _refresh();
      if (generation != _generation) return;
      await loadProfile();
    } catch (error) {
      if (generation != _generation) return;
      if (error is ApiException && error.status == 401) {
        await _clear();
      } else {
        sessionError = 'No se pudo recuperar la sesión. Revisa tu conexión e inténtalo de nuevo.';
      }
    } finally {
      if (generation == _generation) {
        restoring = false;
        notifyListeners();
      }
    }
  }

  Future<void> _persist(String? token, int generation) {
    final operation = _storageWrites.catchError((_) {}).then((_) async {
      if (generation != _generation) return;
      if (token == null) {
        await _storage.delete(key: 'refreshToken');
      } else {
        await _storage.write(key: 'refreshToken', value: token);
      }
    });
    _storageWrites = operation;
    return operation;
  }

  Future<void> _saveTokens(Map<String, dynamic> tokens, int generation) async {
    if (generation != _generation) return;
    await _persist(tokens['refreshToken'] as String, generation);
    if (generation != _generation) return;
    _accessToken = tokens['accessToken'] as String;
    _refreshToken = tokens['refreshToken'] as String;
    if (tokens['user'] is Map) user = Map<String, dynamic>.from(tokens['user'] as Map);
    notifyListeners();
  }

  Future<void> _clear() async {
    final generation = ++_generation;
    _renewal = null;
    restoring = false;
    sessionError = null;
    _accessToken = null;
    _refreshToken = null;
    user = null;
    notifyListeners();
    await _persist(null, generation);
  }

  Future<void> login(String email, String password) async {
    await _clear();
    final generation = _generation;
    sessionMessage = null;
    final result = await request('POST', '/auth/login', body: {'email': email, 'password': password}, auth: false);
    await _saveTokens(Map<String, dynamic>.from(result as Map), generation);
    if (generation == _generation) {
      try { await loadProfile(); } catch (_) {
        if (generation == _generation) {
          sessionError = 'No se pudieron cargar tus datos. Reintenta para recuperar tu perfil.';
          notifyListeners();
        }
        rethrow;
      }
    }
  }

  Future<void> loadProfile() async {
    final generation = _generation;
    final result = await request('GET', '/auth/me');
    if (generation != _generation) return;
    user = Map<String, dynamic>.from(result as Map);
    sessionError = null;
    notifyListeners();
  }

  Future<void> updateProfile(String name, String phone) async {
    final generation = _generation;
    final result = await request('PATCH', '/auth/me', body: {'name': name.trim(), 'phone': phone.trim()});
    if (generation != _generation) return;
    user = Map<String, dynamic>.from(result as Map);
    notifyListeners();
  }

  Future<void> changePassword(String currentPassword, String newPassword) async {
    await request('POST', '/auth/password/change', body: {'currentPassword': currentPassword, 'newPassword': newPassword});
    sessionMessage = 'Contraseña actualizada. Inicia sesión nuevamente.';
    await _clear();
  }

  Future<void> register(String name, String email, String password) async {
    await request('POST', '/auth/register', body: {
      'name': name, 'email': email, 'password': password, 'acceptedTerms': true,
    }, auth: false);
    await login(email, password);
  }

  Future<void> logout() async {
    final token = _refreshToken;
    await _clear();
    if (token != null) {
      try { await request('POST', '/auth/logout', body: {'refreshToken': token}, auth: false); } catch (_) { /* Sesión local cerrada. */ }
    }
  }

  Future<void> _refresh() => _renewal ??= _performRefresh();

  Future<void> _performRefresh() async {
    final generation = _generation;
    if (_refreshToken == null) throw ApiException(401, 'Sesión vencida');
    try {
      final result = await request('POST', '/auth/refresh', body: {'refreshToken': _refreshToken}, auth: false);
      await _saveTokens(Map<String, dynamic>.from(result as Map), generation);
    } finally {
      if (generation == _generation) _renewal = null;
    }
  }

  Future<dynamic> request(String method, String path, {Object? body, bool auth = true, bool retry = true,
      Map<String, String>? headers}) async {
    final generation = _generation;
    final uri = Uri.parse('$baseUrl$path');
    final accessToken = _accessToken;
    final response = await _client.send(http.Request(method, uri)
      ..headers.addAll({'Accept': 'application/json', if (body != null) 'Content-Type': 'application/json',
        if (auth && _accessToken != null) 'Authorization': 'Bearer $_accessToken', ...?headers})
      ..body = body == null ? '' : jsonEncode(body)).then(http.Response.fromStream);
    if (auth && generation != _generation) throw ApiException(409, 'La sesión ha cambiado');
    if (response.statusCode == 401 && auth && retry && _refreshToken != null) {
      if (accessToken != _accessToken && _accessToken != null) {
        return request(method, path, body: body, auth: auth, retry: false, headers: headers);
      }
      try { await _refresh(); } catch (error) {
        if (error is ApiException && error.status == 401 && generation == _generation) await _clear();
        rethrow;
      }
      if (generation != _generation) throw ApiException(409, 'La sesión ha cambiado');
      return request(method, path, body: body, auth: auth, retry: false, headers: headers);
    }
    if (response.statusCode == 401 && auth && generation == _generation) await _clear();
    if (response.statusCode >= 400) {
      dynamic parsed;
      try { parsed = jsonDecode(response.body); } catch (_) { parsed = null; }
      throw ApiException(response.statusCode, parsed is Map && parsed['message'] is String
          ? parsed['message'] as String : 'Error de conexión con la plataforma');
    }
    if (response.statusCode == 204 || response.body.isEmpty) return null;
    return jsonDecode(response.body);
  }

  Future<Map<String, dynamic>> submitReport(Map<String, dynamic> body, String clientRequestId) async {
    final result = await request('POST', '/incidents', body: {...body, 'clientRequestId': clientRequestId},
        headers: {'Idempotency-Key': clientRequestId}, auth: signedIn);
    final receipt = Map<String, dynamic>.from(result as Map);
    final permission = receipt.remove('guestEvidenceToken');
    if (permission is String) {
      await _storage.write(key: 'guestEvidence:${receipt['id']}', value: permission);
    }
    return receipt;
  }

  Future<void> uploadPhoto(String incidentId, String filePath) async {
    final permission = await _storage.read(key: 'guestEvidence:$incidentId');
    if (_accessToken == null && permission == null) {
      throw ApiException(401, 'No se recibió el permiso para la foto. El reporte ya está confirmado.');
    }
    final extension = filePath.split('.').last.toLowerCase();
    final mime = switch (extension) { 'png' => 'image/png', 'webp' => 'image/webp', _ => 'image/jpeg' };
    final request = http.MultipartRequest('POST', Uri.parse('$baseUrl/incidents/$incidentId/evidence'))
      ..headers.addAll(permission != null ? {'X-Evidence-Token': permission} : {'Authorization': 'Bearer $_accessToken'})
      ..files.add(await http.MultipartFile.fromPath('photo', filePath, contentType: MediaType.parse(mime)));
    final response = await _client.send(request).then(http.Response.fromStream);
    if (response.statusCode >= 400) {
      dynamic parsed;
      try { parsed = jsonDecode(response.body); } catch (_) { parsed = null; }
      throw ApiException(response.statusCode, parsed is Map && parsed['message'] is String
          ? parsed['message'] as String : 'La foto no pudo enviarse');
    }
  }

  Future<List<Map<String, dynamic>>> list(String path, {bool auth = false}) async {
    final result = await request('GET', path, auth: auth);
    return (result as List).map((item) => Map<String, dynamic>.from(item as Map)).toList();
  }

  @override
  void dispose() { _client.close(); super.dispose(); }
}
