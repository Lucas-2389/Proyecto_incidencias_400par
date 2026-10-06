import 'package:flutter/material.dart';

import '../core/api.dart';
import 'common.dart';

class AlertsScreen extends StatefulWidget {
  const AlertsScreen({super.key, required this.api});
  final ApiClient api;
  @override
  State<AlertsScreen> createState() => _AlertsScreenState();
}

class _AlertsScreenState extends State<AlertsScreen> {
  final district = TextEditingController();
  late Future<List<Map<String, dynamic>>> alerts = load();
  Future<List<Map<String, dynamic>>> load() => widget.api.list(
    '/public/alerts${district.text.isEmpty ? '' : '?districtId=${district.text.trim()}'}');
  @override
  void dispose() { district.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) => ListView(children: [ScreenPadding(child: Column(
    crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('Alertas vigentes', style: Theme.of(context).textTheme.headlineSmall),
      const Text('Publicaciones activas para tu distrito y alertas generales.'),
      Row(children: [Expanded(child: TextField(controller: district, keyboardType: TextInputType.number,
        decoration: const InputDecoration(labelText: 'Distrito ID (opcional)'))),
        IconButton(onPressed: () => setState(() => alerts = load()), icon: const Icon(Icons.search), tooltip: 'Filtrar alertas')]),
      FutureBuilder<List<Map<String, dynamic>>>(future: alerts, builder: (context, snapshot) {
        if (snapshot.hasError) return MessageCard(message: 'No se pudieron cargar alertas: ${snapshot.error}');
        if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
        if (snapshot.data!.isEmpty) return const MessageCard(message: 'No hay alertas vigentes para esta zona.');
        return Column(children: snapshot.data!.map((alert) => Card(child: ListTile(
          leading: const Icon(Icons.warning_amber_outlined), title: Text(alert['title'] as String),
          subtitle: Text('${alert['message']}\nHasta ${formatDate(alert['validUntil'])}'), isThreeLine: true,
        ))).toList());
      }),
    ]))]);
}
