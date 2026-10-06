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

  Future<void> restore() async {
    _refreshToken = await _storage.read(key: 'refreshToken');
    if (_refreshToken == null) return;
    try {
      await _refresh();
    } catch (_) {
      await _clear();
    }
  }

  Future<void> _saveTokens(Map<String, dynamic> tokens) async {
    _accessToken = tokens['accessToken'] as String;
    _refreshToken = tokens['refreshToken'] as String;
    if (tokens['user'] is Map) user = Map<String, dynamic>.from(tokens['user'] as Map);
    await _storage.write(key: 'refreshToken', value: _refreshToken);
    notifyListeners();
  }

  Future<void> _clear() async {
    _accessToken = null;
    _refreshToken = null;
    user = null;
    await _storage.delete(key: 'refreshToken');
    notifyListeners();
  }

  Future<void> login(String email, String password) async {
    final result = await request('POST', '/auth/login', body: {'email': email, 'password': password}, auth: false);
    await _saveTokens(Map<String, dynamic>.from(result as Map));
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

  Future<void> _refresh() async {
    if (_refreshToken == null) throw ApiException(401, 'Sesión vencida');
    final result = await request('POST', '/auth/refresh', body: {'refreshToken': _refreshToken}, auth: false);
    await _saveTokens(Map<String, dynamic>.from(result as Map));
  }

  Future<dynamic> request(String method, String path, {Object? body, bool auth = true, bool retry = true,
      Map<String, String>? headers}) async {
    final uri = Uri.parse('$baseUrl$path');
    final response = await _client.send(http.Request(method, uri)
      ..headers.addAll({'Accept': 'application/json', if (body != null) 'Content-Type': 'application/json',
        if (auth && _accessToken != null) 'Authorization': 'Bearer $_accessToken', ...?headers})
      ..body = body == null ? '' : jsonEncode(body)).then(http.Response.fromStream);
    if (response.statusCode == 401 && auth && retry && _refreshToken != null) {
      try { await _refresh(); } catch (_) { await _clear(); rethrow; }
      return request(method, path, body: body, auth: auth, retry: false, headers: headers);
    }
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
        headers: {'Idempotency-Key': clientRequestId});
    return Map<String, dynamic>.from(result as Map);
  }

  Future<void> uploadPhoto(String incidentId, String filePath) async {
    if (_accessToken == null) throw ApiException(401, 'Inicia sesión para adjuntar una foto');
    final extension = filePath.split('.').last.toLowerCase();
    final mime = switch (extension) { 'png' => 'image/png', 'webp' => 'image/webp', _ => 'image/jpeg' };
    final request = http.MultipartRequest('POST', Uri.parse('$baseUrl/incidents/$incidentId/evidence'))
      ..headers['Authorization'] = 'Bearer $_accessToken'
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
