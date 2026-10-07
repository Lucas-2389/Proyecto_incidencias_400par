import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:incidencias_mobile/app.dart';
import 'package:incidencias_mobile/core/api.dart';
import 'package:incidencias_mobile/core/pending.dart';

class DemoApi extends ApiClient {
  DemoApi() : super(baseUrl: 'http://example.invalid/api/v1');
  @override
  Future<List<Map<String, dynamic>>> list(String path, {bool auth = false}) async => [];
}

class SignedInApi extends DemoApi {
  @override
  bool get signedIn => true;
  @override
  Future<List<Map<String, dynamic>>> list(String path, {bool auth = false}) async {
    if (path == '/incidents/mine') { return [{'id': 'own-1', 'reference': 'AYA-TEST',
      'status': 'assigned', 'createdAt': '2026-01-01T00:00:00Z'}]; }
    if (path == '/notifications/mine') { return [{'id': 'notice-1', 'title': 'Atención iniciada',
      'message': 'Tu reporte cambió de estado', 'readAt': null}]; }
    return [];
  }
  @override
  Future<dynamic> request(String method, String path, {Object? body, bool auth = true, bool retry = true,
      Map<String, String>? headers}) async => {
    'id': 'own-1', 'reference': 'AYA-TEST', 'status': 'assigned',
    'createdAt': '2026-01-01T00:00:00Z', 'description': 'Incendio DEMO',
  };
}

class EmptyPending implements PendingRepository {
  @override
  Future<List<PendingReport>> all() async => [];
  @override
  Future<void> save(PendingReport report) async {}
  @override
  Future<void> remove(String clientRequestId) async {}
}

void main() {
  testWidgets('navega y oculta reportes privados al invitado', (tester) async {
    final api = DemoApi();
    await tester.pumpWidget(IncidenciasApp(api: api, pending: EmptyPending(), watchConnectivity: false));
    await tester.pumpAndSettle();
    expect(find.text('Inicio'), findsWidgets);
    await tester.tap(find.text('Mis reportes').first);
    await tester.pumpAndSettle();
    expect(find.textContaining('Los reportes de invitado no muestran historial privado'), findsOneWidget);
    tester.state<ScaffoldState>(find.byType(Scaffold).first).openDrawer();
    await tester.pumpAndSettle();
    await tester.tap(find.text('Alertas').last);
    await tester.pumpAndSettle();
    expect(find.text('Alertas vigentes'), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
    api.dispose();
  });

  testWidgets('cuenta ciudadana ve estado propio y notificación', (tester) async {
    final api = SignedInApi();
    await tester.pumpWidget(IncidenciasApp(api: api, pending: EmptyPending(), watchConnectivity: false));
    await tester.tap(find.text('Mis reportes').first);
    await tester.pumpAndSettle();
    expect(find.text('AYA-TEST'), findsOneWidget);
    expect(find.textContaining('assigned'), findsOneWidget);
    expect(find.text('Atención iniciada'), findsOneWidget);
    await tester.tap(find.text('AYA-TEST'));
    await tester.pumpAndSettle();
    expect(find.text('Estado actual: assigned'), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
    api.dispose();
  });
}
