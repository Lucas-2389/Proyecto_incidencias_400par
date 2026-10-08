import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:incidencias_mobile/core/api.dart';
import 'package:incidencias_mobile/core/pending.dart';
import 'package:incidencias_mobile/screens/report.dart';

class ReportApi extends ApiClient {
  ReportApi() : super(baseUrl: 'http://example.invalid/api/v1');
  Map<String, dynamic>? lastBody;
  String? lastKey;
  @override
  Future<List<Map<String, dynamic>>> list(
    String path, {
    bool auth = false,
  }) async => [
    {'id': 1, 'name': 'Incendio'},
  ];
  @override
  Future<Map<String, dynamic>> submitReport(
    Map<String, dynamic> body,
    String clientRequestId,
  ) async {
    lastBody = body;
    lastKey = clientRequestId;
    return {'id': 'i-1', 'reference': 'AYA-TEST', 'status': 'reported'};
  }
}

class ReportPending implements PendingRepository {
  @override
  Future<List<PendingReport>> all() async => [];
  @override
  Future<void> save(PendingReport report) async {}
  @override
  Future<void> remove(String clientRequestId) async {}
}

Future<void> fillReport(WidgetTester tester) async {
  await tester.tap(find.byType(DropdownButtonFormField<int>));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Incendio').last);
  await tester.pumpAndSettle();
  await tester.enterText(
    find.widgetWithText(TextFormField, 'Describe lo sucedido'),
    'Humo en el mercado',
  );
}

void main() {
  testWidgets(
    'GPS concedido y referencia de calle se envían con la ubicación',
    (tester) async {
      tester.view.physicalSize = const Size(1000, 1800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final api = ReportApi();
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ReportScreen(
              api: api,
              submissions: SubmissionService(api, ReportPending()),
              locationReader: () async =>
                  LocationFix(-13.1, -74.1, 5, DateTime.utc(2026, 1, 1)),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await fillReport(tester);
      await tester.tap(find.text('Usar mi ubicación'));
      await tester.pumpAndSettle();
      expect(find.textContaining('Precisión estimada: 5 m'), findsOneWidget);
      await tester.enterText(
        find.byKey(const Key('locationReference')),
        'Av. Mariscal Cáceres, frente al mercado',
      );
      await tester.enterText(
        find.byKey(const Key('contactPhone')),
        '+51 999 111 222',
      );
      await tester.ensureVisible(find.text('Enviar reporte'));
      await tester.tap(find.text('Enviar reporte'));
      await tester.pumpAndSettle();
      expect(api.lastBody?['location'], containsPair('latitude', -13.1));
      expect(api.lastBody?['location'], containsPair('longitude', -74.1));
      expect(
        api.lastBody?['location'],
        containsPair('reference', 'Av. Mariscal Cáceres, frente al mercado'),
      );
      expect(api.lastBody?['callerContact'], '+51 999 111 222');
      expect(api.lastKey, isNotEmpty);
      expect(find.textContaining('AYA-TEST'), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
      api.dispose();
    },
  );

  testWidgets('GPS denegado deja elegir el punto en el mapa', (tester) async {
    tester.view.physicalSize = const Size(1000, 1800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final api = ReportApi();
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ReportScreen(
            api: api,
            submissions: SubmissionService(api, ReportPending()),
            locationReader: () async =>
                throw Exception('Permiso de ubicación denegado'),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Usar mi ubicación'));
    await tester.pumpAndSettle();
    expect(
      find.textContaining('Permiso de ubicación denegado'),
      findsOneWidget,
    );
    expect(find.byKey(const Key('latitude')), findsNothing);
    expect(find.byKey(const Key('longitude')), findsNothing);
    await fillReport(tester);
    await tester.ensureVisible(find.byType(FlutterMap));
    await tester.tap(find.byType(FlutterMap));
    await tester.pumpAndSettle();
    expect(find.text('Punto seleccionado en el mapa'), findsOneWidget);
    await tester.ensureVisible(find.text('Enviar reporte'));
    await tester.tap(find.text('Enviar reporte'));
    await tester.pumpAndSettle();
    expect(api.lastBody?['location'], isNotNull);
    await tester.pumpWidget(const SizedBox.shrink());
    api.dispose();
  });
}
