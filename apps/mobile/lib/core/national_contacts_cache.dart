import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class NationalContactsCache {
  NationalContactsCache({Future<SharedPreferences> Function()? loadPreferences})
    : _loadPreferences = loadPreferences ?? SharedPreferences.getInstance;
  static const key = 'nationalEmergencyContactsV1';
  final Future<SharedPreferences> Function() _loadPreferences;
  Future<void> _writes = Future.value();

  Future<Map<String, dynamic>?> read() async {
    final preferences = await _loadPreferences();
    final stored = preferences.getString(key);
    if (stored == null) return null;
    final decoded = jsonDecode(stored);
    if (decoded is! Map ||
        decoded['entries'] is! List ||
        DateTime.tryParse(decoded['updatedAt'].toString()) == null) {
      throw const FormatException('Contactos almacenados no válidos');
    }
    final entries = (decoded['entries'] as List).map((entry) {
      if (entry is! Map ||
          entry['name'] is! String ||
          entry['phone'] is! String ||
          entry['scope'] != 'national') {
        throw const FormatException('Contacto nacional no válido');
      }
      return Map<String, dynamic>.from(entry);
    }).toList();
    return {'entries': entries, 'updatedAt': decoded['updatedAt']};
  }

  Future<void> save(List<Map<String, dynamic>> entries) {
    final value = jsonEncode({
      'entries': entries,
      'updatedAt': DateTime.now().toUtc().toIso8601String(),
    });
    final operation = _writes.catchError((Object _) {}).then((_) async {
      final preferences = await _loadPreferences();
      if (!await preferences.setString(key, value)) {
        throw StateError('No se pudieron guardar los contactos nacionales');
      }
    });
    _writes = operation;
    return operation;
  }
}
