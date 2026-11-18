import 'package:flutter_test/flutter_test.dart';
import 'package:incidencias_mobile/core/public_favorites.dart';
import 'package:shared_preferences/shared_preferences.dart';

const id = '00000000-0000-4000-8000-000000000001';

class _FailingPreferences implements SharedPreferences {
  List<String> disk = [id];
  List<String> cache = [id];
  bool fail = true;
  @override
  Object? get(String key) => List<String>.from(cache);
  @override
  Future<bool> setStringList(String key, List<String> value) async {
    cache = List.from(value);
    if (fail) return false;
    disk = List.from(value);
    return true;
  }

  @override
  Future<void> reload() async {
    cache = List.from(disk);
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test(
    'un rechazo del disco recupera la caché antes de reabrir favoritos',
    () async {
      final preferences = _FailingPreferences();
      final favorites = PublicFavorites(
        loadPreferences: () async => preferences,
      );
      await favorites.load();
      await expectLater(favorites.setSaved(id, false), throwsException);
      expect(favorites.ids, [id]);
      expect(preferences.cache, [id]);
      final restored = PublicFavorites(
        loadPreferences: () async => preferences,
      );
      await restored.load();
      expect(restored.ids, [id]);
      preferences.fail = false;
      await favorites.setSaved(id, false);
      expect(preferences.disk, isEmpty);
      favorites.dispose();
      restored.dispose();
    },
  );
  test(
    'deduplica, serializa escrituras y recupera solo identificadores tras reiniciar',
    () async {
      SharedPreferences.setMockInitialValues({
        PublicFavorites.key: [id, id, 'invalid'],
        'pendingReportsV1': ['pending'],
      });
      final preferences = await SharedPreferences.getInstance();
      final favorites = PublicFavorites(
        loadPreferences: () async => preferences,
      );
      await favorites.load();
      expect(favorites.ids, [id]);
      await Future.wait([
        favorites.setSaved(id, false),
        favorites.setSaved(id, true),
        favorites.setSaved(id, true),
      ]);
      final restored = PublicFavorites(
        loadPreferences: () async => preferences,
      );
      await restored.load();
      expect(restored.ids, [id]);
      expect(preferences.getStringList(PublicFavorites.key), [id]);
      expect(preferences.getStringList('pendingReportsV1'), ['pending']);
      await restored.setSaved(id, false);
      expect(restored.ids, isEmpty);
      favorites.dispose();
      restored.dispose();
    },
  );
  test('fallo al persistir conserva estado y permite reintentar', () async {
    SharedPreferences.setMockInitialValues({});
    final preferences = await SharedPreferences.getInstance();
    bool fail = false;
    final favorites = PublicFavorites(
      loadPreferences: () async {
        if (fail) throw Exception('storage');
        return preferences;
      },
    );
    await favorites.load();
    fail = true;
    await expectLater(favorites.setSaved(id, true), throwsException);
    expect(favorites.ids, isEmpty);
    fail = false;
    await favorites.setSaved(id, true);
    fail = true;
    await expectLater(favorites.setSaved(id, false), throwsException);
    expect(favorites.ids, [id]);
    expect(preferences.getStringList(PublicFavorites.key), [id]);
    favorites.dispose();
  });
  test('almacenamiento dañado se restablece sin tocar otros datos', () async {
    SharedPreferences.setMockInitialValues({
      PublicFavorites.key: 'corrupt',
      'pendingReportsV1': ['pending'],
    });
    final preferences = await SharedPreferences.getInstance();
    final favorites = PublicFavorites(loadPreferences: () async => preferences);
    await expectLater(favorites.load(), throwsFormatException);
    await favorites.reset();
    await favorites.load();
    expect(favorites.ids, isEmpty);
    expect(preferences.getStringList('pendingReportsV1'), ['pending']);
    favorites.dispose();
  });
}
