import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../core/api.dart';
import '../core/config.dart';
import '../core/public_favorites.dart';
import '../core/territory.dart';
import 'common.dart';
import 'public_incident.dart';

IconData categoryIcon(String? code) => switch (code) {
  'fire' => Icons.local_fire_department,
  'traffic_accident' => Icons.car_crash,
  'medical_emergency' => Icons.emergency,
  'flood' => Icons.flood,
  'landslide' => Icons.landslide,
  'earthquake_damage' => Icons.broken_image,
  'other_emergency' => Icons.sos,
  'robbery' => Icons.local_police,
  'assault' => Icons.shield,
  'fight' => Icons.sports_mma,
  'vandalism' => Icons.format_paint,
  'aggression' => Icons.personal_injury,
  'harassment' => Icons.report,
  'violence' => Icons.front_hand,
  'suspicious_activity' => Icons.visibility,
  'other_security' => Icons.security,
  _ => Icons.warning_amber,
};

class MapViewScreen extends StatefulWidget {
  const MapViewScreen({super.key, required this.api, required this.favorites});
  final ApiClient api;
  final PublicFavorites favorites;
  @override
  State<MapViewScreen> createState() => _MapViewScreenState();
}

class _MapViewScreenState extends State<MapViewScreen> {
  List<Map<String, dynamic>> categories = [];
  List<Map<String, dynamic>> districts = [];
  List<Map<String, dynamic>> incidents = [];
  List<Map<String, dynamic>> boundaries = [];
  final mapController = MapController();
  bool mapReady = false;
  String? boundaryError;
  int boundaryGeneration = 0;
  int? categoryId;
  int? districtId;
  DateTimeRange? dates;
  String? interval;
  String? error;
  String? favoritesError;
  bool loading = true;
  bool catalogsLoaded = false;
  int generation = 0;
  @override
  void initState() {
    super.initState();
    load();
    loadBoundaries();
    widget.favorites.load().catchError((Object _) {
      if (mounted) {
        setState(
          () => favoritesError =
              'No se pudieron leer los favoritos. Puedes restablecerlos desde Favoritos.',
        );
      }
    });
  }

  @override
  void dispose() {
    mapController.dispose();
    super.dispose();
  }

  Future<void> loadBoundaries() async {
    final current = ++boundaryGeneration;
    try {
      final result =
          await widget.api.request(
                'GET',
                metropolitanBoundariesPath,
                auth: false,
              )
              as Map;
      final features = (result['features'] as List)
          .map((feature) => Map<String, dynamic>.from(feature as Map))
          .toList();
      if (!mounted || current != boundaryGeneration) return;
      setState(() {
        boundaries = features;
        boundaryError = null;
      });
      fitDistrict();
    } catch (_) {
      if (mounted && current == boundaryGeneration) {
        setState(() => boundaryError = 'No se pudieron cargar los límites.');
      }
    }
  }

  void fitDistrict() {
    if (!mapReady) return;
    final points = <LatLng>[];
    for (final feature in boundaries) {
      if (districtId != null &&
          (feature['properties'] as Map)['id'] != districtId) {
        continue;
      }
      final bbox = feature['bbox'] as List;
      points.add(
        LatLng((bbox[1] as num).toDouble(), (bbox[0] as num).toDouble()),
      );
      points.add(
        LatLng((bbox[3] as num).toDouble(), (bbox[2] as num).toDouble()),
      );
    }
    if (points.isNotEmpty) {
      mapController.fitCamera(
        CameraFit.bounds(
          bounds: LatLngBounds.fromPoints(points),
          padding: const EdgeInsets.all(24),
        ),
      );
    }
  }

  List<Polygon> districtPolygons() {
    final polygons = <Polygon>[];
    for (final feature in boundaries) {
      final selected = (feature['properties'] as Map)['id'] == districtId;
      for (final coordinates
          in ((feature['geometry'] as Map)['coordinates'] as List)) {
        final rings = (coordinates as List)
            .map(
              (ring) => (ring as List)
                  .map(
                    (point) => LatLng(
                      (point[1] as num).toDouble(),
                      (point[0] as num).toDouble(),
                    ),
                  )
                  .toList(),
            )
            .toList();
        if (rings.isEmpty) continue;
        polygons.add(
          Polygon(
            points: rings.first,
            holePointsList: rings.skip(1).toList(),
            color: selected ? const Color(0x200F766E) : const Color(0x0564748B),
            borderColor: selected
                ? const Color(0xFF0F766E)
                : const Color(0xFF64748B),
            borderStrokeWidth: selected ? 3 : 1,
            label: (feature['properties'] as Map)['name'] as String?,
          ),
        );
      }
    }
    return polygons;
  }

  Future<void> load() async {
    final current = ++generation;
    setState(() {
      loading = true;
      error = null;
      incidents = [];
      interval = null;
    });
    final query = <String, String>{
      if (categoryId != null) 'categoryId': '$categoryId',
      if (districtId != null) 'districtId': '$districtId',
      if (dates != null) ...{
        'from': DateTime(
          dates!.start.year,
          dates!.start.month,
          dates!.start.day,
        ).toUtc().toIso8601String(),
        'to': DateTime(
          dates!.end.year,
          dates!.end.month,
          dates!.end.day + 1,
        ).toUtc().toIso8601String(),
      },
    };
    try {
      if (!catalogsLoaded) {
        final catalogs = await Future.wait([
          widget.api.list('/catalog/categories'),
          widget.api.list(metropolitanDistrictsPath),
        ]);
        if (!mounted || current != generation) return;
        categories = catalogs[0];
        districts = catalogs[1];
        catalogsLoaded = true;
      }
      final path = Uri(
        path: '/public/incidents',
        queryParameters: query.isEmpty ? null : query,
      ).toString();
      final result = Map<String, dynamic>.from(
        await widget.api.request('GET', path, auth: false) as Map,
      );
      if (!mounted || current != generation) return;
      setState(() {
        incidents = (result['incidents'] as List)
            .map((item) => Map<String, dynamic>.from(item as Map))
            .toList();
        interval =
            '${formatDate(result['from'])} – ${formatDate(result['to'])}';
      });
    } catch (issue) {
      if (mounted && current == generation) {
        setState(() => error = 'No se pudo cargar el mapa. $issue');
      }
    } finally {
      if (mounted && current == generation) setState(() => loading = false);
    }
  }

  Future<void> pickDates() async {
    final selected = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2000),
      lastDate: DateTime.now(),
      initialDateRange: dates,
      helpText: 'Fechas del reporte',
    );
    if (!mounted || selected == null) return;
    final from = DateTime(
      selected.start.year,
      selected.start.month,
      selected.start.day,
    ).toUtc();
    final to = DateTime(
      selected.end.year,
      selected.end.month,
      selected.end.day + 1,
    ).toUtc();
    if (to.difference(from) > const Duration(days: 90)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Elige un intervalo de hasta 90 días.')),
      );
      return;
    }
    setState(() => dates = selected);
    await load();
  }

  String? codeFor(int? id) {
    for (final category in categories) {
      if (category['id'] == id) return category['code'] as String?;
    }
    return null;
  }

  Future<void> select(List<Map<String, dynamic>> group) async {
    Map<String, dynamic>? selected = group.first;
    if (group.length > 1) {
      selected = await showModalBottomSheet<Map<String, dynamic>>(
        context: context,
        builder: (context) => SafeArea(
          child: ListView(
            shrinkWrap: true,
            children: [
              for (final incident in group)
                ListTile(
                  title: Text(incident['reference'] as String),
                  subtitle: Text(
                    publicCategory(incident['categoryId'] as int?, categories),
                  ),
                  onTap: () => Navigator.pop(context, incident),
                ),
            ],
          ),
        ),
      );
    }
    if (!mounted || selected == null) return;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => PublicIncidentSheet(
        api: widget.api,
        id: selected!['id'] as String,
        categories: categories,
        favorites: widget.favorites,
      ),
    );
  }

  Widget filters() => Padding(
    padding: const EdgeInsets.all(16),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'Mapa de incidentes',
                style: Theme.of(context).textTheme.titleLarge,
              ),
            ),
            IconButton(
              tooltip: 'Favoritos',
              icon: const Icon(Icons.star_outline),
              onPressed: () async {
                await Navigator.push(
                  context,
                  MaterialPageRoute<void>(
                    builder: (_) => PublicFavoritesScreen(
                      api: widget.api,
                      favorites: widget.favorites,
                      categories: categories,
                    ),
                  ),
                );
                if (mounted) {
                  setState(() => favoritesError = null);
                  await load();
                }
              },
            ),
          ],
        ),
        DropdownButtonFormField<int>(
          key: const Key('mapCategory'),
          initialValue: categoryId,
          isExpanded: true,
          decoration: const InputDecoration(labelText: 'Categoría'),
          items: [
            const DropdownMenuItem<int>(value: null, child: Text('Todas')),
            ...categories.map(
              (item) => DropdownMenuItem(
                value: item['id'] as int,
                child: Text(item['name'] as String),
              ),
            ),
          ],
          onChanged: (value) {
            setState(() => categoryId = value);
            load();
          },
        ),
        const SizedBox(height: 12),
        DropdownButtonFormField<int>(
          key: const Key('mapDistrict'),
          initialValue: districtId,
          isExpanded: true,
          decoration: const InputDecoration(labelText: 'Distrito'),
          items: [
            const DropdownMenuItem<int>(value: null, child: Text('Todos')),
            ...districts.map(
              (item) => DropdownMenuItem(
                value: item['id'] as int,
                child: Text(item['name'] as String),
              ),
            ),
          ],
          onChanged: (value) {
            setState(() => districtId = value);
            fitDistrict();
            load();
          },
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          children: [
            OutlinedButton.icon(
              key: const Key('mapDates'),
              onPressed: pickDates,
              icon: const Icon(Icons.date_range),
              label: Text(
                dates == null ? 'Fechas (opcional)' : 'Cambiar fechas',
              ),
            ),
            if (dates != null)
              TextButton(
                onPressed: () {
                  setState(() => dates = null);
                  load();
                },
                child: const Text('Borrar fechas'),
              ),
          ],
        ),
        if (interval != null)
          Text(
            '${dates == null ? 'Últimos 7 días · ' : ''}$interval',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        if (favoritesError != null) Text(favoritesError!),
        const Text('Ubicaciones aproximadas · Límites referenciales del INEI'),
        if (boundaryError != null)
          Row(
            children: [
              Expanded(child: Text(boundaryError!)),
              TextButton(
                onPressed: loadBoundaries,
                child: const Text('Reintentar límites'),
              ),
            ],
          ),
      ],
    ),
  );

  @override
  Widget build(BuildContext context) {
    final groups = <String, List<Map<String, dynamic>>>{};
    for (final incident in incidents) {
      final location = incident['location'] as Map;
      final key = '${location['latitude']},${location['longitude']}';
      groups.putIfAbsent(key, () => []).add(incident);
    }
    return LayoutBuilder(
      builder: (context, constraints) => Column(
        children: [
          ConstrainedBox(
            constraints: BoxConstraints(
              maxHeight: constraints.maxHeight * 0.55,
            ),
            child: SingleChildScrollView(child: filters()),
          ),
          if (loading) const LinearProgressIndicator(),
          if (error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  Expanded(child: Text(error!)),
                  TextButton(onPressed: load, child: const Text('Reintentar')),
                ],
              ),
            ),
          if (!loading && error == null && incidents.isEmpty)
            const Padding(
              padding: EdgeInsets.all(8),
              child: Text('Sin incidentes para estos filtros.'),
            ),
          Expanded(
            child: FlutterMap(
              mapController: mapController,
              options: MapOptions(
                initialCenter: const LatLng(-13.16, -74.22),
                initialZoom: 12,
                onMapReady: () {
                  mapReady = true;
                  fitDistrict();
                },
              ),
              children: [
                TileLayer(
                  urlTemplate: AppConfig.tileUrl,
                  userAgentPackageName: 'org.incidencias.mobile',
                ),
                PolygonLayer(polygons: districtPolygons()),
                MarkerLayer(
                  markers: groups.entries.map((entry) {
                    final group = entry.value;
                    final incident = group.first;
                    final location = incident['location'] as Map;
                    final label = group.length > 1
                        ? '${group.length} incidentes. Elegir reporte'
                        : '${publicCategory(incident['categoryId'] as int?, categories)}. ${incident['reference']}';
                    return Marker(
                      point: LatLng(
                        (location['latitude'] as num).toDouble(),
                        (location['longitude'] as num).toDouble(),
                      ),
                      width: 52,
                      height: 52,
                      child: Semantics(
                        button: true,
                        label: label,
                        child: Tooltip(
                          message: label,
                          child: Material(
                            color: const Color(0xFF086C63),
                            shape: const CircleBorder(),
                            child: InkWell(
                              key: Key('mapMarker-${incident['id']}'),
                              customBorder: const CircleBorder(),
                              onTap: () => select(group),
                              child: Center(
                                child: group.length > 1
                                    ? Text(
                                        '${group.length}',
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      )
                                    : Icon(
                                        categoryIcon(
                                          codeFor(
                                            incident['categoryId'] as int?,
                                          ),
                                        ),
                                        color: Colors.white,
                                      ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
                const RichAttributionWidget(
                  attributions: [
                    TextSourceAttribution('© OpenStreetMap contributors'),
                  ],
                ),
              ],
            ),
          ),
          ConstrainedBox(
            constraints: BoxConstraints(
              maxHeight: constraints.maxHeight * 0.15,
            ),
            child: SingleChildScrollView(
              child: Padding(
                padding: const EdgeInsets.all(8),
                child: Wrap(
                  spacing: 12,
                  runSpacing: 8,
                  children: [
                    const Text('Ubicaciones aproximadas'),
                    for (final category in categories.where(
                      (item) => incidents.any(
                        (incident) => incident['categoryId'] == item['id'],
                      ),
                    ))
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            categoryIcon(category['code'] as String?),
                            size: 20,
                          ),
                          const SizedBox(width: 4),
                          Flexible(child: Text(category['name'] as String)),
                        ],
                      ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
