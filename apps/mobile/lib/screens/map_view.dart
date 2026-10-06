import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../core/api.dart';
import '../core/config.dart';
import 'common.dart';

class MapViewScreen extends StatefulWidget {
  const MapViewScreen({super.key, required this.api});
  final ApiClient api;
  @override
  State<MapViewScreen> createState() => _MapViewScreenState();
}

class _MapViewScreenState extends State<MapViewScreen> {
  late Future<List<Map<String, dynamic>>> cells = load();
  int days = 7;
  Future<List<Map<String, dynamic>>> load() {
    final to = DateTime.now().toUtc();
    final from = to.subtract(Duration(days: days));
    return widget.api.list('/public/heatmap?from=${Uri.encodeQueryComponent(from.toIso8601String())}&to=${Uri.encodeQueryComponent(to.toIso8601String())}');
  }
  @override
  Widget build(BuildContext context) => Column(children: [
    ScreenPadding(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('Mapa de calor', style: Theme.of(context).textTheme.headlineSmall),
      const Text('Solo concentraciones agregadas. No se muestran puntos exactos de reportes.'),
      DropdownButton<int>(value: days, items: const [
        DropdownMenuItem(value: 1, child: Text('Últimas 24 horas')),
        DropdownMenuItem(value: 7, child: Text('Últimos 7 días')),
        DropdownMenuItem(value: 30, child: Text('Últimos 30 días')),
      ], onChanged: (value) => setState(() { days = value ?? 7; cells = load(); })),
    ])),
    Expanded(child: FutureBuilder<List<Map<String, dynamic>>>(future: cells, builder: (context, snapshot) {
      if (snapshot.hasError) return MessageCard(message: 'No se pudo cargar el mapa: ${snapshot.error}');
      if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
      return Stack(children: [FlutterMap(options: const MapOptions(initialCenter: LatLng(-13.16, -74.22), initialZoom: 12),
        children: [TileLayer(urlTemplate: AppConfig.tileUrl, userAgentPackageName: 'org.incidencias.mobile'),
          CircleLayer(circles: snapshot.data!.map((cell) => CircleMarker(
            point: LatLng((cell['latitude'] as num).toDouble(), (cell['longitude'] as num).toDouble()),
            radius: 18 + ((cell['count'] as num).toDouble().clamp(3, 30)),
            color: const Color(0x88E56C42), borderColor: const Color(0xFFB74B28), borderStrokeWidth: 2,
          )).toList()),
          const RichAttributionWidget(attributions: [TextSourceAttribution('© OpenStreetMap contributors')]),
        ]),
        Positioned(left: 12, top: 12, child: Chip(label: Text('${snapshot.data!.length} celdas visibles · mínimo 3 reportes'))),
      ]);
    })),
  ]);
}
