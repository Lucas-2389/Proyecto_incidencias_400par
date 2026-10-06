import 'package:flutter/material.dart';

import '../core/api.dart';
import 'common.dart';

class MineScreen extends StatefulWidget {
  const MineScreen({super.key, required this.api});
  final ApiClient api;
  @override
  State<MineScreen> createState() => _MineScreenState();
}

class _MineScreenState extends State<MineScreen> {
  Future<List<Map<String, dynamic>>>? reports;
  Future<List<Map<String, dynamic>>>? notices;
  @override
  void initState() { super.initState(); refresh(); }
  void refresh() {
    if (!widget.api.signedIn) { return; }
    setState(() { reports = widget.api.list('/incidents/mine', auth: true);
      notices = widget.api.list('/notifications/mine', auth: true); });
  }
  @override
  Widget build(BuildContext context) {
    if (!widget.api.signedIn) { return const ScreenPadding(child: MessageCard(
      message: 'Inicia sesión en Perfil para ver solo tus reportes y notificaciones. Los reportes de invitado no muestran historial privado.',
      icon: Icons.lock_outline)); }
    return RefreshIndicator(onRefresh: () async { refresh(); await reports; }, child: ListView(children: [
      ScreenPadding(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Mis reportes', style: Theme.of(context).textTheme.headlineSmall),
        FutureBuilder<List<Map<String, dynamic>>>(future: reports, builder: (context, snapshot) {
          if (snapshot.hasError) return MessageCard(message: 'No se pudieron cargar los reportes: ${snapshot.error}');
          if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
          if (snapshot.data!.isEmpty) return const MessageCard(message: 'Aún no tienes reportes confirmados.');
          return Column(children: snapshot.data!.map((item) => Card(child: ListTile(
            title: Text(item['reference']?.toString() ?? 'Reporte'),
            subtitle: Text('${item['status']} · ${formatDate(item['createdAt'])}'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.push(context, MaterialPageRoute<void>(builder: (_) => ReportDetail(api: widget.api, id: item['id'] as String))),
          ))).toList());
        }),
        const SizedBox(height: 20), Text('Notificaciones', style: Theme.of(context).textTheme.titleLarge),
        FutureBuilder<List<Map<String, dynamic>>>(future: notices, builder: (context, snapshot) {
          if (snapshot.hasError) return MessageCard(message: 'No se pudieron cargar avisos: ${snapshot.error}');
          if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
          return Column(children: snapshot.data!.map((item) => Card(child: ListTile(
            leading: Icon(item['readAt'] == null ? Icons.notifications_active_outlined : Icons.notifications_none),
            title: Text(item['title'] as String), subtitle: Text(item['message'] as String),
            onTap: () async { await widget.api.request('PATCH', '/notifications/${item['id']}/read'); refresh(); },
          ))).toList());
        }),
      ])),
    ]));
  }
}

class ReportDetail extends StatelessWidget {
  const ReportDetail({super.key, required this.api, required this.id});
  final ApiClient api;
  final String id;
  @override
  Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: const Text('Seguimiento')),
    body: FutureBuilder<dynamic>(future: api.request('GET', '/incidents/$id'), builder: (context, snapshot) {
      if (snapshot.hasError) return MessageCard(message: snapshot.error.toString());
      if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
      final incident = Map<String, dynamic>.from(snapshot.data as Map);
      return ListView(children: [ScreenPadding(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(incident['reference'] as String, style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 12), MessageCard(message: 'Estado actual: ${incident['status']}'),
        Card(child: ListTile(title: const Text('Descripción'), subtitle: Text(incident['description']?.toString() ?? '—'))),
        Card(child: ListTile(title: const Text('Fecha de reporte'), subtitle: Text(formatDate(incident['createdAt'])))),
        const Text('La institución actualiza el estado durante la atención.'),
      ]))]);
    }));
}
