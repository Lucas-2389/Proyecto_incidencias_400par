import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:incidencias_mobile/core/api.dart';
import 'package:incidencias_mobile/core/public_favorites.dart';
import 'package:incidencias_mobile/screens/map_view.dart';
import 'package:incidencias_mobile/screens/public_incident.dart';
import 'package:shared_preferences/shared_preferences.dart';

const publicId = '00000000-0000-4000-8000-000000000001';
const secondId = '00000000-0000-4000-8000-000000000002';
const publicCategories = [
  {'id': 2, 'code': 'medical_emergency', 'name': 'Emergencia médica'},
];
const publicDistricts = [
  {'id': 3, 'name': 'Ayacucho'},
  {'id': 4, 'name': 'Carmen Alto'},
  {'id': 5, 'name': 'San Juan Bautista'},
  {'id': 6, 'name': 'Jesús Nazareno'},
  {'id': 7, 'name': 'Andrés Avelino Cáceres Dorregaray'},
];

class PublicMapApi extends ApiClient {
  PublicMapApi() : super(baseUrl: 'http://example.invalid/api/v1');
  final paths = <String>[];
  bool fail = false;
  bool hidden = false;
  bool empty = false;
  bool coincident = false;
  String status = 'reported';
  Completer<dynamic>? delayed;
  Map<String, dynamic> incident(String id) => {
    'id': id,
    'reference': id == publicId ? 'DEMO-1' : 'DEMO-2',
    'categoryId': 2,
    'districtId': 3,
    'status': status,
    'createdAt': '2026-11-01T12:00:00Z',
    'location': {
      'latitude': -13.165,
      'longitude': -74.225,
      'approximate': true,
      'cellSizeDegrees': 0.01,
    },
  };
  @override
  Future<List<Map<String, dynamic>>> list(
    String path, {
    bool auth = false,
  }) async {
    paths.add(path);
    expect(auth, isFalse);
    return path.contains('categories') ? publicCategories : publicDistricts;
  }

  @override
  Future<dynamic> request(
    String method,
    String path, {
    Object? body,
    bool auth = true,
    bool retry = true,
    Map<String, String>? headers,
  }) async {
    paths.add(path);
    expect(auth, isFalse);
    if (fail) throw Exception('offline');
    if (path.startsWith('/territory/districts/boundaries')) {
      return {
        'features': publicDistricts
            .map(
              (district) => {
                'properties': district,
                'bbox': [-74.23, -13.17, -74.22, -13.16],
                'geometry': {
                  'type': 'MultiPolygon',
                  'coordinates': [
                    [
                      [
                        [-74.23, -13.17],
                        [-74.22, -13.17],
                        [-74.22, -13.16],
                        [-74.23, -13.17],
                      ],
                    ],
                  ],
                },
              },
            )
            .toList(),
      };
    }
    if (Uri.parse(path).path == '/public/incidents') {
      if (delayed != null) return delayed!.future;
      return {
        'incidents': empty
            ? []
            : [incident(publicId), if (coincident) incident(secondId)],
        'from': '2026-11-09T12:00:00Z',
        'to': '2026-11-16T12:00:00Z',
      };
    }
    if (hidden) throw ApiException(404, 'Reporte no disponible');
    return incident(Uri.parse(path).pathSegments.last);
  }
}

Future<PublicFavorites> favoritesStore() async {
  SharedPreferences.setMockInitialValues({});
  final preferences = await SharedPreferences.getInstance();
  final store = PublicFavorites(loadPreferences: () async => preferences);
  await store.load();
  return store;
}

void main() {
  testWidgets('cinco contornos permanecen visibles sin incidentes y destacan el distrito elegido', (tester) async {
    final api = PublicMapApi()..empty = true;
    final favorites = await favoritesStore();
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: MapViewScreen(api: api, favorites: favorites))));
    await tester.pumpAndSettle();
    expect(find.text('Sin incidentes para estos filtros.'), findsOneWidget);
    expect(tester.widget<PolygonLayer>(find.byType(PolygonLayer)).polygons, hasLength(5));
    await tester.tap(find.byKey(const Key('mapDistrict')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Andrés Avelino Cáceres Dorregaray').last);
    await tester.pumpAndSettle();
    final layer = tester.widget<PolygonLayer>(find.byType(PolygonLayer));
    expect(layer.polygons.where((polygon) => polygon.borderStrokeWidth == 3), hasLength(1));
    expect(api.paths.any((path) => path.contains('districtId=7')), isTrue);
    expect(find.textContaining('Límites referenciales del INEI'), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
    favorites.dispose(); api.dispose();
  });

  testWidgets(
    'fechas convierten días inclusivos a UTC y permiten borrar el intervalo',
    (tester) async {
      final api = PublicMapApi();
      final favorites = await favoritesStore();
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: MapViewScreen(api: api, favorites: favorites),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('mapDates')));
      await tester.pumpAndSettle();
      await tester.tap(find.byIcon(Icons.edit_outlined));
      await tester.pumpAndSettle();
      final inputs = find.byType(TextField);
      await tester.enterText(inputs.at(0), '11/01/2026');
      await tester.enterText(inputs.at(1), '11/02/2026');
      await tester.tap(find.text('OK'));
      await tester.pumpAndSettle();
      final query = Uri.parse(api.paths.last).queryParameters;
      expect(query['from'], DateTime(2026, 11, 1).toUtc().toIso8601String());
      expect(query['to'], DateTime(2026, 11, 3).toUtc().toIso8601String());
      await tester.tap(find.text('Borrar fechas'));
      await tester.pumpAndSettle();
      expect(Uri.parse(api.paths.last).queryParameters, isEmpty);
      expect(find.textContaining('Últimos 7 días'), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
      favorites.dispose();
      api.dispose();
    },
  );
  testWidgets(
    'mapa usa filtros ordenados, descarta consultas tardías y permite reintento',
    (tester) async {
      final api = PublicMapApi();
      final favorites = await favoritesStore();
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: MapViewScreen(api: api, favorites: favorites),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.byType(CircleLayer), findsNothing);
      expect(find.byKey(const Key('mapMarker-$publicId')), findsOneWidget);
      expect(
        api.paths.every(
          (path) => !path.contains('heatmap') && !path.contains('/ops/'),
        ),
        isTrue,
      );
      expect(
        tester.getTopLeft(find.byKey(const Key('mapCategory'))).dy,
        lessThan(tester.getTopLeft(find.byKey(const Key('mapDistrict'))).dy),
      );
      expect(
        tester.getTopLeft(find.byKey(const Key('mapDistrict'))).dy,
        lessThan(tester.getTopLeft(find.byKey(const Key('mapDates'))).dy),
      );
      final old = Completer<dynamic>();
      api.delayed = old;
      await tester.tap(find.byKey(const Key('mapCategory')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Emergencia médica').last);
      await tester.pump();
      api.delayed = null;
      api.empty = true;
      await tester.tap(find.byKey(const Key('mapDistrict')));
      await tester.pump(const Duration(seconds: 1));
      await tester.tap(find.text('Ayacucho').last);
      await tester.pumpAndSettle();
      old.complete({
        'incidents': [api.incident(publicId)],
        'from': '2026-01-01',
        'to': '2026-01-02',
      });
      await tester.pumpAndSettle();
      expect(find.text('Sin incidentes para estos filtros.'), findsOneWidget);
      final filtered = Uri.parse(api.paths.last);
      expect(filtered.queryParameters, {'categoryId': '2', 'districtId': '3'});
      api.fail = true;
      await tester.tap(find.byKey(const Key('mapCategory')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Todas').last);
      await tester.pumpAndSettle();
      expect(find.textContaining('No se pudo cargar el mapa.'), findsOneWidget);
      api.fail = false;
      api.empty = false;
      await tester.tap(find.text('Reintentar'));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('mapMarker-$publicId')), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
      favorites.dispose();
      api.dispose();
    },
  );

  testWidgets(
    'marcadores coincidentes permiten guardar favorito y ver estado público',
    (tester) async {
      final api = PublicMapApi()..coincident = true;
      final favorites = await favoritesStore();
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: MapViewScreen(api: api, favorites: favorites),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('mapMarker-$publicId')));
      await tester.pumpAndSettle();
      expect(find.text('DEMO-1'), findsOneWidget);
      expect(find.text('DEMO-2'), findsOneWidget);
      await tester.tap(find.text('DEMO-2'));
      await tester.pumpAndSettle();
      expect(find.text('Ubicación aproximada'), findsOneWidget);
      await tester.tap(find.text('Guardar favorito'));
      await tester.pumpAndSettle();
      expect(favorites.ids, [secondId]);
      api.status = 'assigned';
      await tester.tap(find.text('Actualizar estado'));
      await tester.pumpAndSettle();
      expect(find.text('Estado: Asignado'), findsOneWidget);
      api.hidden = true;
      await tester.tap(find.text('Actualizar estado'));
      await tester.pumpAndSettle();
      expect(find.text('No disponible'), findsOneWidget);
      expect(find.text('DEMO-2'), findsNothing);
      expect(find.text('Quitar favorito'), findsOneWidget);
      expect(
        api.paths.where((path) => path.startsWith('/incidents/')),
        isEmpty,
      );
      await tester.pumpWidget(const SizedBox.shrink());
      favorites.dispose();
      api.dispose();
    },
  );

  testWidgets('favoritos actualizan fuera del mapa y permiten quitar sin red', (
    tester,
  ) async {
    final api = PublicMapApi();
    final favorites = await favoritesStore();
    await favorites.setSaved(publicId, true);
    await tester.pumpWidget(
      MaterialApp(
        home: PublicFavoritesScreen(
          api: api,
          favorites: favorites,
          categories: publicCategories,
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Reportado'), findsOneWidget);
    api.status = 'resolved';
    await tester.tap(find.text('Actualizar favoritos'));
    await tester.pumpAndSettle();
    expect(find.text('Resuelto'), findsOneWidget);
    api.fail = true;
    await tester.tap(find.text('Actualizar favoritos'));
    await tester.pumpAndSettle();
    expect(find.text('No se pudo actualizar. Reintenta.'), findsOneWidget);
    await tester.tap(find.byTooltip('Quitar favorito'));
    await tester.pumpAndSettle();
    expect(favorites.ids, isEmpty);
    expect(
      api.paths.every((path) => path == '/public/incidents/$publicId'),
      isTrue,
    );
    await tester.pumpWidget(const SizedBox.shrink());
    favorites.dispose();
    api.dispose();
  });

  testWidgets(
    'mapa mantiene acceso a filtros con pantalla compacta y texto ampliado',
    (tester) async {
      tester.view.physicalSize = const Size(360, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final api = PublicMapApi();
      final favorites = await favoritesStore();
      await tester.pumpWidget(
        MaterialApp(
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(
              context,
            ).copyWith(textScaler: const TextScaler.linear(1.6)),
            child: child!,
          ),
          home: Scaffold(
            body: MapViewScreen(api: api, favorites: favorites),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.byKey(const Key('mapDates')));
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
      favorites.dispose();
      api.dispose();
    },
  );
}
