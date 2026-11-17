import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

class PublicFavorites extends ChangeNotifier {
  PublicFavorites({Future<SharedPreferences> Function()? loadPreferences})
    : _loadPreferences = loadPreferences ?? SharedPreferences.getInstance;

  static const key = 'publicIncidentFavoritesV1';
  final Future<SharedPreferences> Function() _loadPreferences;
  final _ids = <String>{};
  Future<void>? _loading;
  Future<void> _writes = Future.value();
  List<String> get ids => List.unmodifiable(_ids);
  bool contains(String id) => _ids.contains(id);

  Future<void> load() => _loading ??= _read();

  Future<void> _read() async {
    try {
      final preferences = await _loadPreferences();
      final stored = preferences.get(key);
      if (stored != null && stored is! List<String>) {
        throw const FormatException(
          'Favoritos locales dañados. Puedes restablecerlos.',
        );
      }
      final values = (stored as List<String>?) ?? [];
      final validId = RegExp(
        r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
      );
      _ids.addAll(values.where(validId.hasMatch));
    } catch (_) {
      _loading = null;
      rethrow;
    }
  }

  Future<void> setSaved(String id, bool saved) {
    final operation = _writes.catchError((_) {}).then((_) async {
      await load();
      final updated = {..._ids};
      if (saved) {
        updated.add(id);
      } else {
        updated.remove(id);
      }
      final preferences = await _loadPreferences();
      await _persistIds(preferences, updated.toList());
      _ids
        ..clear()
        ..addAll(updated);
      notifyListeners();
    });
    _writes = operation;
    return operation;
  }

  Future<void> _persistIds(
    SharedPreferences preferences,
    List<String> ids,
  ) async {
    try {
      if (!await preferences.setStringList(key, ids)) {
        throw Exception('No se pudieron guardar los favoritos.');
      }
    } catch (_) {
      // SharedPreferences cambia su caché antes de confirmar la escritura al disco.
      try {
        await preferences.reload();
      } catch (_) {
        /* Conservamos el estado confirmado del repositorio. */
      }
      rethrow;
    }
  }

  Future<void> reset() {
    final operation = _writes.catchError((_) {}).then((_) async {
      final preferences = await _loadPreferences();
      await _persistIds(preferences, []);
      _ids.clear();
      _loading = Future.value();
      notifyListeners();
    });
    _writes = operation;
    return operation;
  }
}
