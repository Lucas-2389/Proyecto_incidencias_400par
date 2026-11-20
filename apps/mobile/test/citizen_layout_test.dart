import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:incidencias_mobile/app.dart';
import 'package:incidencias_mobile/core/app_theme.dart';
import 'widget_test.dart' show DemoApi, EmptyPending;

void main() {
  testWidgets('inicio compacto conserva reporte y acceso directo a contactos', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final api = DemoApi();
    await tester.pumpWidget(
      IncidenciasApp(
        api: api,
        pending: EmptyPending(),
        watchConnectivity: false,
      ),
    );
    await tester.pumpAndSettle();
    final context = tester.element(find.text('Crear reporte'));
    expect(Theme.of(context).colorScheme.primary, AppColors.blue);
    await tester.ensureVisible(find.text('Teléfonos de emergencia'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Teléfonos de emergencia'));
    await tester.pumpAndSettle();
    expect(find.text('Contactos de emergencia'), findsOneWidget);
    expect(api.requests.any((path) => path.contains('/auth/')), isFalse);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
    api.dispose();
  });
}
