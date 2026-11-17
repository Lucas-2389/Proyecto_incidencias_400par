import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:http/http.dart' as http;
import 'package:http/io_client.dart';
import 'package:incidencias_mobile/core/api.dart';
import 'package:incidencias_mobile/core/pending.dart';
import 'package:incidencias_mobile/core/public_favorites.dart';
import 'package:incidencias_mobile/screens/map_view.dart';
import 'package:incidencias_mobile/screens/report.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _RealHttpOverrides extends HttpOverrides {}

class _LocalClient extends http.BaseClient {
  _LocalClient()
    : inner = HttpOverrides.runWithHttpOverrides(
        () => IOClient(HttpClient()),
        _RealHttpOverrides(),
      );
  final http.Client inner;
  bool offline = false;
  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) {
    if (offline) throw http.ClientException('DEMO offline');
    return inner.send(request);
  }

  @override
  void close() => inner.close();
}

class _LocalApi extends ApiClient {
  _LocalApi(http.Client client)
    : super(baseUrl: 'http://127.0.0.1:3017/api/v1', client: client);
  final realZone = Zone.current;
  final pending = <Future<dynamic>>{};
  @override
  Future<dynamic> request(
    String method,
    String path, {
    Object? body,
    bool auth = true,
    bool retry = true,
    Map<String, String>? headers,
  }) {
    final operation = realZone.run(
      () => super.request(
        method,
        path,
        body: body,
        auth: auth,
        retry: retry,
        headers: headers,
      ),
    );
    pending.add(operation);
    operation.then(
      (_) => pending.remove(operation),
      onError: (Object _) => pending.remove(operation),
    );
    return operation;
  }
}

Future<void> _settleLocal(WidgetTester tester, _LocalApi api) async {
  for (var attempt = 0; attempt < 10; attempt++) {
    await tester.pump();
    await Future.wait(
      api.pending.toList().map(
        (operation) => operation.then<void>((_) {}, onError: (Object _) {}),
      ),
    );
    await tester.pump();
    if (api.pending.isEmpty) {
      await tester.pumpAndSettle();
      return;
    }
  }
  fail('La API local no terminó sus consultas.');
}

Future<void> changeFixture(String id, String action) async {
  final result = await Process.run('node', [
    '-e',
    r'''
const mysql = require('mysql2/promise');
const { randomUUID } = require('node:crypto');
const { loadTestDatabaseConfig } = require('./scripts/integration-config');
(async () => {
  const config = loadTestDatabaseConfig();
  if (!['localhost','127.0.0.1'].includes(config.host)) throw Error('Local test database required');
  const id = process.argv[1];
  if (!/^[0-9a-f-]{36}$/.test(id)) throw Error('Invalid fixture');
  const pool = mysql.createPool(config);
  try {
    if (process.argv[2] === 'resolved') {
      await pool.execute("UPDATE incidents SET status='resolved' WHERE id=?", [id]);
    } else {
      const [[row]] = await pool.execute('SELECT category_id AS categoryId FROM incidents WHERE id=?', [id]);
      const [subtype] = await pool.execute(
        "INSERT INTO incident_subcategories(category_id,code,name,is_sensitive) VALUES (?,?,'DEMO sensitive fixture',TRUE)",
        [row.categoryId, 'demo_' + randomUUID().slice(0,8)]);
      await pool.execute('UPDATE incidents SET subcategory_id=? WHERE id=?', [subtype.insertId,id]);
    }
  } finally { await pool.end(); }
})().catch(() => { console.error('Local test fixture failed'); process.exitCode=1; });
''',
    id,
    action,
  ], workingDirectory: '../api');
  expect(result.exitCode, 0, reason: result.stderr.toString());
}

void main() {
  const enabled = bool.fromEnvironment('RUN_LOCAL_TRIAGE_DEMO');
  testWidgets(
    'DEMO local HTTP y UI: pendiente clínico, favorito ajeno y retiro sensible',
    (tester) async {
      await tester.runAsync(() async {
        final cache = await Directory.systemTemp.createTemp(
          'incidencias-map-demo-',
        );
        final mapCache = BuiltInMapCachingProvider.getOrCreateInstance(
          cacheDirectory: cache.path,
          readOnly: true,
        );
        addTearDown(() async {
          await mapCache.destroy();
          await cache.delete(recursive: true);
        });
        tester.view.physicalSize = const Size(1000, 2400);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        FlutterSecureStorage.setMockInitialValues({});
        SharedPreferences.setMockInitialValues({});
        final preferences = await SharedPreferences.getInstance();
        final client = _LocalClient();
        final owner = _LocalApi(client);
        final visitor = _LocalApi(_LocalClient());
        await owner.register(
          'DEMO Flutter local',
          'flutter-${DateTime.now().microsecondsSinceEpoch}@demo.invalid',
          'local-demo-test-password',
        );
        final favorites = PublicFavorites(
          loadPreferences: () async => preferences,
        );
        addTearDown(() {
          favorites.dispose();
          owner.dispose();
          visitor.dispose();
        });
        final repository = SharedPendingRepository(preferences);
        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: ReportScreen(
                api: owner,
                submissions: SubmissionService(owner, repository),
                locationReader: () async =>
                    LocationFix(-13.131, -74.191, 5, DateTime.utc(2026)),
              ),
            ),
          ),
        );
        await _settleLocal(tester, owner);
        await tester.tap(find.byKey(const Key('reportCategory')));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Emergencia médica').last);
        await _settleLocal(tester, owner);
        await tester.tap(find.byKey(const Key('isConscious-false')));
        await tester.tap(find.byKey(const Key('isBreathing-true')));
        await tester.enterText(
          find.widgetWithText(TextFormField, 'Describe lo sucedido'),
          'DEMO local Flutter. Persona principal junto al vehículo. Sin emergencia real.',
        );
        await tester.ensureVisible(find.text('Usar mi ubicación'));
        await tester.tap(find.text('Usar mi ubicación'));
        await tester.pumpAndSettle();
        client.offline = true;
        await tester.ensureVisible(find.text('Enviar reporte'));
        await tester.tap(find.text('Enviar reporte'));
        await tester.pumpAndSettle();
        expect(find.textContaining('Pendiente de envío.'), findsOneWidget);
        final restored = SharedPendingRepository(preferences);
        final queued = (await restored.all()).single;
        expect(queued.body['isConscious'], false);
        expect(queued.body['isBreathing'], true);
        client.offline = false;
        final results = await SubmissionService(owner, restored).retryPending();
        final receipt = results.single.receipt!;
        final id = receipt['id'] as String;
        final repeated = await owner.submitReport(
          queued.body,
          queued.clientRequestId,
        );
        expect(repeated['id'], id);
        await expectLater(
          visitor.request('GET', '/incidents/$id'),
          throwsA(isA<ApiException>().having((e) => e.status, 'status', 401)),
        );
        final own = await owner.request('GET', '/incidents/$id') as Map;
        expect(own['isConscious'], false);
        await favorites.load();
        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: MapViewScreen(api: visitor, favorites: favorites),
            ),
          ),
        );
        await _settleLocal(tester, visitor);
        await tester.tap(find.byKey(const Key('mapCategory')));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Emergencia médica').last);
        await _settleLocal(tester, visitor);
        await tester.tap(find.byKey(Key('mapMarker-$id')));
        await _settleLocal(tester, visitor);
        if (find.text('Guardar favorito').evaluate().isEmpty) {
          await tester.tap(find.text(receipt['reference'] as String));
          await _settleLocal(tester, visitor);
        }
        await tester.tap(find.text('Guardar favorito'));
        await tester.pumpAndSettle();
        final restoredFavorites = PublicFavorites(
          loadPreferences: () async => preferences,
        );
        await restoredFavorites.load();
        expect(restoredFavorites.ids, [id]);
        restoredFavorites.dispose();
        await changeFixture(id, 'resolved');
        await tester.tap(find.text('Actualizar estado'));
        await _settleLocal(tester, visitor);
        expect(find.text('Estado: Resuelto'), findsOneWidget);
        await changeFixture(id, 'hidden');
        await tester.tap(find.text('Actualizar estado'));
        await _settleLocal(tester, visitor);
        expect(find.text('No disponible'), findsOneWidget);
        expect(find.text(receipt['reference'] as String), findsNothing);
        await tester.tap(find.text('Quitar favorito'));
        await tester.pumpAndSettle();
        expect(favorites.ids, isEmpty);
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox.shrink());
      });
    },
    skip: !enabled,
    timeout: const Timeout(Duration(minutes: 2)),
  );
}
