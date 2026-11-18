import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:incidencias_mobile/core/api.dart';
import 'package:incidencias_mobile/core/national_contacts_cache.dart';
import 'package:incidencias_mobile/screens/alerts.dart';
import 'package:incidencias_mobile/screens/directory.dart';
import 'package:shared_preferences/shared_preferences.dart';

const districts = [
  {'id': 1, 'name': 'Ayacucho'},
  {'id': 2, 'name': 'Carmen Alto'},
  {'id': 3, 'name': 'San Juan Bautista'},
  {'id': 4, 'name': 'Jesús Nazareno'},
  {'id': 5, 'name': 'Andrés Avelino Cáceres Dorregaray'},
];

class ContactsApi extends ApiClient {
  ContactsApi() : super(baseUrl: 'http://example.invalid/api/v1');
  bool fail = false;
  bool failDistricts = false;
  List<Map<String, dynamic>> nationals = [
    {'name': 'Nacional publicado', 'phone': '066123456', 'scope': 'national'},
  ];
  final paths = <String>[];
  @override
  Future<List<Map<String, dynamic>>> list(String path, {bool auth = false}) async {
    paths.add(path);
    expect(auth, isFalse);
    final uri = Uri.parse(path);
    if (uri.path == '/territory/districts') {
      if (failDistricts) throw Exception('offline');
      return districts;
    }
    if (fail) throw Exception('offline');
    if (uri.path == '/public/alerts') {
      return [
        {'id': 'general', 'title': 'Aviso general', 'message': 'Información pública', 'validUntil': '2026-12-01T12:00:00Z'},
        if (uri.queryParameters['districtId'] == '2')
          {'id': 'local', 'title': 'Aviso Carmen Alto', 'message': 'Información local', 'validUntil': '2026-12-01T12:00:00Z'},
      ];
    }
    return [
      ...nationals,
      if (uri.queryParameters['districtId'] == '2')
        {'id': 'local', 'name': 'Local Carmen Alto', 'phone': '066222222', 'scope': 'local', 'districtName': 'Carmen Alto', 'institutionName': 'Municipalidad', 'siteName': 'Base local'},
    ];
  }
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('la copia nacional reemplaza correcciones, desactivaciones y listas vacías', () async {
    final cache = NationalContactsCache();
    expect(await cache.read(), isNull);
    await cache.save([{'name': 'Policía', 'phone': '105', 'scope': 'national'}]);
    await cache.save([{'name': 'Policía', 'phone': '066123456', 'scope': 'national'}]);
    expect((await cache.read())!['entries'][0]['phone'], '066123456');
    await cache.save([]);
    expect((await cache.read())!['entries'], isEmpty);
    final preferences = await SharedPreferences.getInstance();
    await preferences.setString(NationalContactsCache.key, 'invalid');
    await expectLater(cache.read(), throwsFormatException);
  });

  testWidgets('contactos consultan por nombre de distrito y conservan los nacionales', (tester) async {
    final api = ContactsApi();
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: DirectoryScreen(api: api))));
    await tester.pumpAndSettle();
    expect(find.text('Nacional publicado'), findsOneWidget);
    await tester.tap(find.byType(DropdownButtonFormField<int>));
    await tester.pumpAndSettle();
    for (final district in districts) {
      expect(find.text(district['name'] as String), findsWidgets);
    }
    await tester.tap(find.text('Carmen Alto').last);
    await tester.pumpAndSettle();
    expect(api.paths, contains('/public/directory?districtId=2'));
    expect(find.text('Local Carmen Alto'), findsOneWidget);
    expect(find.text('Nacional publicado'), findsOneWidget);
    expect(find.textContaining('Municipalidad · Base local'), findsOneWidget);
  });

  testWidgets('primera apertura offline, actualización y pérdida de red usan la copia correcta', (tester) async {
    final calls = <MethodCall>[];
    const channel = MethodChannel('plugins.flutter.io/url_launcher');
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(channel, (call) async { calls.add(call); return true; });
    addTearDown(() => TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(channel, null));
    final api = ContactsApi()..fail = true;
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: DirectoryScreen(api: api))));
    await tester.pumpAndSettle();
    expect(find.text('Policía Nacional'), findsOneWidget);
    expect(calls, isEmpty);
    await tester.ensureVisible(find.byTooltip('Llamar al 105'));
    await tester.tap(find.byTooltip('Llamar al 105'));
    await tester.pumpAndSettle();
    expect(calls.any((call) => (call.arguments as Map)['url'] == 'tel:105'), isTrue);
    api.fail = false;
    await tester.ensureVisible(find.text('Actualizar contactos'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Actualizar contactos'));
    await tester.pumpAndSettle();
    expect(find.text('Nacional publicado'), findsOneWidget);
    expect(find.text('Policía Nacional'), findsNothing);
    api.fail = true;
    await tester.tap(find.text('Actualizar contactos'));
    await tester.pumpAndSettle();
    expect(find.text('Nacional publicado'), findsOneWidget);
    expect(find.textContaining('Copia almacenada'), findsOneWidget);
    api.fail = false;
    api.nationals = [];
    await tester.tap(find.text('Actualizar contactos'));
    await tester.pumpAndSettle();
    api.fail = true;
    await tester.tap(find.text('Actualizar contactos'));
    await tester.pumpAndSettle();
    expect(find.text('Policía Nacional'), findsNothing);
    expect(find.text('Nacional publicado'), findsNothing);
  });

  testWidgets('alertas combinan generales y locales y recuperan el catálogo', (tester) async {
    final api = ContactsApi()..failDistricts = true;
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: AlertsScreen(api: api))));
    await tester.pumpAndSettle();
    expect(find.text('Aviso general'), findsOneWidget);
    api.failDistricts = false;
    await tester.tap(find.text('Reintentar distritos'));
    await tester.pumpAndSettle();
    await tester.tap(find.byType(DropdownButtonFormField<int>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Carmen Alto').last);
    await tester.pumpAndSettle();
    expect(api.paths, contains('/public/alerts?districtId=2'));
    expect(find.text('Aviso general'), findsOneWidget);
    expect(find.text('Aviso Carmen Alto'), findsOneWidget);
  });
}
