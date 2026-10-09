import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:incidencias_mobile/app.dart';
import 'package:incidencias_mobile/core/api.dart';
import 'package:incidencias_mobile/core/pending.dart';

class DemoApi extends ApiClient {
  DemoApi() : super(baseUrl: 'https://example.invalid/api/v1');
  final requests = <String>[];
  @override
  Future<List<Map<String, dynamic>>> list(String path, {bool auth = false}) async {
    requests.add(path);
    return [];
  }
}

class OfflineApi extends DemoApi {
  @override
  Future<List<Map<String, dynamic>>> list(String path, {bool auth = false}) async => throw Exception('offline');
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
  testWidgets('el invitado reporta sin login y no ve pantallas privadas', (tester) async {
    final api = DemoApi();
    await tester.pumpWidget(IncidenciasApp(api: api, pending: EmptyPending(), watchConnectivity: false));
    await tester.pumpAndSettle();
    expect(find.text('Sin cuenta'), findsOneWidget);
    await tester.tap(find.text('Crear reporte'));
    await tester.pumpAndSettle();
    expect(api.requests, contains('/catalog/categories'));
    expect(find.text('Iniciar sesión'), findsNothing);
    tester.state<ScaffoldState>(find.byType(Scaffold).first).openDrawer();
    await tester.pumpAndSettle();
    expect(find.text('Perfil'), findsNothing);
    expect(find.text('Mis reportes'), findsNothing);
    await tester.ensureVisible(find.text('Conoce la app').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Conoce la app').last);
    await tester.pumpAndSettle();
    expect(find.text('Tu comunidad cuenta contigo'), findsOneWidget);
    expect(api.requests.any((path) => path.contains('/mine') || path.contains('/auth/')), isFalse);
    await tester.pumpWidget(const SizedBox.shrink());
    api.dispose();
  });

  testWidgets('los contactos oficiales siguen visibles sin Internet', (tester) async {
    final api = OfflineApi();
    await tester.pumpWidget(IncidenciasApp(api: api, pending: EmptyPending(), watchConnectivity: false));
    await tester.tap(find.text('Contactos').first);
    await tester.pumpAndSettle();
    for (final number in ['105', '116', '106', '100']) {
      expect(find.text('Llamar al $number'), findsOneWidget);
    }
    expect(find.text('Iniciar sesión'), findsNothing);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
    api.dispose();
  });
}
