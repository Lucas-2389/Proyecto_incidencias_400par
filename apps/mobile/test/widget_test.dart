import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:incidencias_mobile/app.dart';
import 'package:incidencias_mobile/core/api.dart';
import 'package:incidencias_mobile/core/pending.dart';
import 'package:incidencias_mobile/screens/mine.dart';
import 'package:incidencias_mobile/screens/profile.dart';
import 'package:shared_preferences/shared_preferences.dart';

class DemoApi extends ApiClient {
  DemoApi() : super(baseUrl: 'https://example.invalid/api/v1');
  final requests = <String>[];
  bool active = false;
  int version = 0;
  bool fail = false;
  Completer<List<Map<String, dynamic>>>? delayedNotices;
  @override
  bool get signedIn => active;
  @override
  Future<void> login(String email, String password) async {
    active = true;
    user = {'id': email, 'name': 'Ciudadana', 'email': email};
    notifyListeners();
  }
  @override
  Future<void> logout() async { active = false; user = null; notifyListeners(); }
  @override
  Future<void> register(String name, String email, String password) => login(email, password);
  @override
  Future<void> updateProfile(String name, String phone) async {
    if (fail) throw Exception('No se pudo guardar');
    user = {...?user, 'name': name, 'phone': phone};
    notifyListeners();
  }
  int passwordChanges = 0;
  @override
  Future<void> changePassword(String currentPassword, String newPassword) async {
    passwordChanges++;
    if (fail) throw Exception('Contraseña actual incorrecta');
    sessionMessage = 'Contraseña actualizada. Inicia sesión nuevamente.';
    await logout();
  }
  @override
  Future<dynamic> request(String method, String path, {Object? body, bool auth = true,
      bool retry = true, Map<String, String>? headers}) async {
    requests.add(path);
    if (fail) throw Exception('sin conexión');
    return {'id': 'own', 'reference': 'REF-1', 'status': version == 0 ? 'reported' : 'assigned',
      'createdAt': '2026-11-15T12:00:00Z',
      if (version > 0) 'history': [
        {'eventType': 'created', 'newValue': 'reported', 'createdAt': '2026-11-15T12:00:00Z'},
        {'eventType': 'status.changed', 'previousValue': 'reported', 'newValue': 'assigned', 'createdAt': '2026-11-15T13:00:00Z'},
      ]};
  }
  @override
  Future<List<Map<String, dynamic>>> list(String path, {bool auth = false}) async {
    requests.add(path);
    if (path.contains('/mine')) expect(auth, isTrue);
    if (path == '/notifications/mine' && delayedNotices != null) return delayedNotices!.future;
    if (path == '/incidents/mine') return [{'id': 'own', 'reference': 'REF-1', 'status': 'reported', 'createdAt': '2026-11-15T12:00:00Z'}];
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
  testWidgets('editar perfil conserva correo, muestra errores y actualiza cabecera', (tester) async {
    final api = DemoApi();
    await api.login('test@example.invalid', 'password');
    await tester.pumpWidget(IncidenciasApp(api: api, pending: EmptyPending(), watchConnectivity: false));
    await tester.tap(find.byType(ActionChip));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Datos personales'));
    await tester.pumpAndSettle();
    expect(find.byType(TextFormField), findsNWidgets(2));
    expect(find.text('test@example.invalid'), findsOneWidget);
    await tester.enterText(find.byType(TextFormField).at(0), 'Nombre editado');
    await tester.enterText(find.byType(TextFormField).at(1), '999111222');
    api.fail = true;
    await tester.tap(find.text('Guardar cambios'));
    await tester.pumpAndSettle();
    expect(find.textContaining('No se pudo guardar'), findsOneWidget);
    expect(find.text('Nombre editado'), findsOneWidget);
    api.fail = false;
    await tester.tap(find.text('Guardar cambios'));
    await tester.pumpAndSettle();
    expect(find.text('Datos guardados'), findsOneWidget);
    await tester.enterText(find.byType(TextFormField).at(1), '');
    await tester.tap(find.text('Guardar cambios'));
    await tester.pumpAndSettle();
    expect(api.user?['phone'], '');
    await tester.pageBack();
    await tester.pumpAndSettle();
    expect(find.text('Nombre editado'), findsNWidgets(2));
    await tester.pumpWidget(const SizedBox.shrink());
    api.dispose();
  });

  testWidgets('contraseña valida confirmación y vuelve al ingreso después de cambiar', (tester) async {
    final api = DemoApi();
    await api.login('test@example.invalid', 'password');
    await tester.pumpWidget(IncidenciasApp(api: api, pending: EmptyPending(), watchConnectivity: false));
    await tester.tap(find.byType(ActionChip));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Seguridad'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField).at(0), 'old-password');
    await tester.enterText(find.byType(TextFormField).at(1), 'new-test-password');
    await tester.enterText(find.byType(TextFormField).at(2), 'wrong');
    await tester.tap(find.widgetWithText(FilledButton, 'Cambiar contraseña'));
    await tester.pumpAndSettle();
    expect(api.passwordChanges, 0);
    expect(find.text('Las contraseñas no coinciden'), findsOneWidget);
    await tester.enterText(find.byType(TextFormField).at(2), 'new-test-password');
    await tester.tap(find.widgetWithText(FilledButton, 'Cambiar contraseña'));
    await tester.pumpAndSettle();
    expect(api.passwordChanges, 1);
    expect(find.text('Iniciar sesión'), findsOneWidget);
    expect(find.textContaining('Contraseña actualizada.'), findsOneWidget);
    expect(find.byType(ChangePasswordScreen), findsNothing);
    await tester.pumpWidget(const SizedBox.shrink());
    api.dispose();
  });

  testWidgets('formulario compacto con teclado y texto grande permite alcanzar la acción', (tester) async {
    final api = DemoApi();
    tester.view.physicalSize = const Size(360, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(MaterialApp(builder: (context, child) => MediaQuery(
      data: MediaQuery.of(context).copyWith(textScaler: const TextScaler.linear(1.5), viewInsets: const EdgeInsets.only(bottom: 260)), child: child!),
      home: Scaffold(body: ProfileScreen(api: api))));
    await tester.ensureVisible(find.byTooltip('Mostrar contraseña'));
    await tester.pumpAndSettle();
    await tester.drag(find.byType(ListView), const Offset(0, -350));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Mostrar contraseña'));
    await tester.pumpAndSettle();
    expect(tester.widget<EditableText>(find.byType(EditableText).last).obscureText, isFalse);
    await tester.ensureVisible(find.text('Ingresar'));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
    api.dispose();
  });
  testWidgets('registro y cierre de sesión funcionan desde Perfil del menú', (tester) async {
    final api = DemoApi();
    await tester.pumpWidget(IncidenciasApp(api: api, pending: EmptyPending(), watchConnectivity: false));
    await openDrawerDestination(tester, 'Perfil');
    await tester.tap(find.text('Crear cuenta nueva'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField).at(0), 'Ciudadana');
    await tester.enterText(find.byType(TextFormField).at(1), 'new@example.invalid');
    await tester.enterText(find.byType(TextFormField).at(2), 'test-password-long');
    await tester.ensureVisible(find.text('Registrarme'));
    await tester.tap(find.text('Registrarme'));
    await tester.pumpAndSettle();
    expect(find.text('Mi perfil'), findsOneWidget);
    await tester.tap(find.text('Cerrar sesión'));
    await tester.pumpAndSettle();
    expect(api.signedIn, isFalse);
    expect(find.text('Sin cuenta'), findsOneWidget);
    expect(find.text('Mi perfil'), findsNothing);
    await tester.pumpWidget(const SizedBox.shrink());
    api.dispose();
  });
  testWidgets('perfil permite ingresar, seguir reporte y retirar datos al perder sesión', (tester) async {
    final api = DemoApi();
    await tester.pumpWidget(IncidenciasApp(api: api, pending: EmptyPending(), watchConnectivity: false));
    await tester.tap(find.byType(ActionChip));
    await tester.pumpAndSettle();
    expect(find.text('Iniciar sesión'), findsOneWidget);
    await tester.enterText(find.byType(TextFormField).at(0), 'citizen@example.invalid');
    await tester.enterText(find.byType(TextFormField).at(1), 'password');
    await tester.tap(find.text('Ingresar'));
    await tester.pumpAndSettle();
    expect(find.text('Mi perfil'), findsOneWidget);
    await openDrawerDestination(tester, 'Mis reportes');
    expect(find.text('REF-1'), findsOneWidget);
    expect(api.requests, containsAll(['/incidents/mine', '/notifications/mine']));
    await tester.tap(find.text('REF-1'));
    await tester.pumpAndSettle();
    expect(find.text('Estado actual: Reportado'), findsOneWidget);
    expect(find.text('Aún no hay eventos disponibles.'), findsOneWidget);
    api.version = 1;
    await tester.drag(find.byType(ListView).last, const Offset(0, 400));
    await tester.pumpAndSettle();
    expect(find.text('Estado actual: Asignado'), findsOneWidget);
    expect(find.text('Reporte creado'), findsOneWidget);
    expect(api.requests.where((path) => path == '/incidents/own').length, 2);
    await api.logout();
    await tester.pumpAndSettle();
    expect(find.text('Seguimiento'), findsNothing);
    expect(find.text('REF-1'), findsNothing);
    expect(await tester.binding.handlePopRoute(), isFalse);
    await openDrawerDestination(tester, 'Perfil');
    expect(find.text('Iniciar sesión'), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
    api.dispose();
  });

  testWidgets('la recarga del detalle permite recuperar un error', (tester) async {
    final api = DemoApi();
    await tester.pumpWidget(MaterialApp(home: ReportDetail(api: api, id: 'own')));
    await tester.pumpAndSettle();
    api.fail = true;
    await tester.drag(find.byType(ListView), const Offset(0, 400));
    await tester.pumpAndSettle();
    expect(find.textContaining('Exception'), findsOneWidget);
    api.fail = false;
    api.version = 1;
    await tester.drag(find.byType(ListView), const Offset(0, 400));
    await tester.pumpAndSettle();
    expect(find.text('Estado actual: Asignado'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
    api.dispose();
  });

  testWidgets('la bandeja espera ambas consultas al recargar', (tester) async {
    final api = DemoApi();
    await api.login('citizen@example.invalid', 'password');
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: MineScreen(api: api))));
    await tester.pumpAndSettle();
    api.delayedNotices = Completer<List<Map<String, dynamic>>>();
    var finished = false;
    final refresh = tester.widget<RefreshIndicator>(find.byType(RefreshIndicator)).onRefresh();
    refresh.then((_) => finished = true);
    await tester.pump();
    expect(finished, isFalse);
    api.delayedNotices!.complete([]);
    await refresh;
    await tester.pumpAndSettle();
    expect(finished, isTrue);
    await tester.pumpWidget(const SizedBox.shrink());
    api.dispose();
  });
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
    SharedPreferences.setMockInitialValues({});
    final api = OfflineApi();
    await tester.pumpWidget(IncidenciasApp(api: api, pending: EmptyPending(), watchConnectivity: false));
    await tester.tap(find.text('Contactos').first);
    await tester.pumpAndSettle();
    for (final number in ['105', '116', '106', '100']) {
      expect(find.byTooltip('Llamar al $number'), findsOneWidget);
    }
    expect(find.text('Iniciar sesión'), findsNothing);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
    api.dispose();
  });
}

Future<void> openDrawerDestination(WidgetTester tester, String title) async {
  tester.state<ScaffoldState>(find.byType(Scaffold).first).openDrawer();
  await tester.pumpAndSettle();
  await tester.scrollUntilVisible(find.text(title), 180,
    scrollable: find.descendant(of: find.byType(Drawer), matching: find.byType(Scrollable)));
  await tester.tap(find.text(title).last);
  await tester.pumpAndSettle();
}
