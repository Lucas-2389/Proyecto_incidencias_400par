import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:incidencias_mobile/core/api.dart';
import 'package:incidencias_mobile/core/pending.dart';
import 'package:incidencias_mobile/screens/report.dart';

class ReportApi extends ApiClient {
  ReportApi() : super(baseUrl: 'http://example.invalid/api/v1');
  Map<String, dynamic>? lastBody;
  String? lastKey;
  @override
  Future<List<Map<String, dynamic>>> list(String path, {bool auth = false}) async => [
    {'id': 1, 'name': 'Incendio'},
  ];
  @override
  Future<Map<String, dynamic>> submitReport(Map<String, dynamic> body, String clientRequestId) async {
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
  await tester.enterText(find.widgetWithText(TextFormField, 'Describe lo sucedido'), 'Humo en el mercado');
}

void main() {
  testWidgets('GPS concedido, corrección manual y coordenadas finales', (tester) async {
    tester.view.physicalSize = const Size(1000, 1800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final api = ReportApi();
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: ReportScreen(
      api: api, submissions: SubmissionService(api, ReportPending()),
      locationReader: () async => LocationFix(-13.1, -74.1, 5, DateTime.utc(2026, 1, 1)),
    ))));
    await tester.pumpAndSettle();
    await fillReport(tester);
    await tester.tap(find.text('Usar mi GPS'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Precisión estimada: 5 m'), findsOneWidget);
    await tester.enterText(find.byKey(const Key('latitude')), '-13.1601');
    await tester.enterText(find.byKey(const Key('longitude')), '-74.2202');
    await tester.tap(find.byTooltip('Fijar coordenadas'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Enviar reporte'));
    await tester.tap(find.text('Enviar reporte'));
    await tester.pumpAndSettle();
    expect(api.lastBody?['location'], containsPair('latitude', -13.1601));
    expect(api.lastBody?['location'], containsPair('longitude', -74.2202));
    expect(api.lastKey, isNotEmpty);
    expect(find.textContaining('AYA-TEST'), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
    api.dispose();
  });

  testWidgets('GPS denegado permite introducir ubicación manual', (tester) async {
    tester.view.physicalSize = const Size(1000, 1800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final api = ReportApi();
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: ReportScreen(
      api: api, submissions: SubmissionService(api, ReportPending()),
      locationReader: () async => throw Exception('Permiso de ubicación denegado'),
    ))));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Usar mi GPS'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Permiso de ubicación denegado'), findsOneWidget);
    await tester.enterText(find.byKey(const Key('latitude')), '-13.16');
    await tester.enterText(find.byKey(const Key('longitude')), '-74.22');
    await tester.tap(find.byTooltip('Fijar coordenadas'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Enviar reporte'));
    await tester.tap(find.text('Enviar reporte'));
    await tester.pumpAndSettle();
    expect(find.text('Elige una categoría'), findsOneWidget);
    expect(find.text('Describe el incidente'), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
    api.dispose();
  });
}
