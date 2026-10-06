import 'package:flutter/material.dart';

import '../core/pending.dart';
import 'common.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.pending, required this.onReport, required this.onRetry});
  final PendingRepository pending;
  final VoidCallback onReport;
  final Future<void> Function() onRetry;
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late Future<List<PendingReport>> pending = widget.pending.all();
  Future<void> retry() async { await widget.onRetry(); setState(() => pending = widget.pending.all()); }
  @override
  Widget build(BuildContext context) => ListView(children: [
    ScreenPadding(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const SizedBox(height: 16),
      Text('Tu comunidad, más segura', style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold)),
      const SizedBox(height: 8), const Text('Reporta una emergencia o incidente y sigue su atención.'),
      const SizedBox(height: 22),
      Card(color: const Color(0xFF0D796F), child: Padding(padding: const EdgeInsets.all(22), child: Column(
        crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Icon(Icons.add_location_alt_outlined, color: Colors.white, size: 34), const SizedBox(height: 14),
          const Text('¿Necesitas reportar?', style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold)),
          const SizedBox(height: 6), const Text('Comparte lo que sucede y corrige tu ubicación antes de enviar.',
            style: TextStyle(color: Colors.white)), const SizedBox(height: 18),
          FilledButton.icon(onPressed: widget.onReport, icon: const Icon(Icons.arrow_forward), label: const Text('Crear reporte'),
            style: FilledButton.styleFrom(backgroundColor: Colors.white, foregroundColor: const Color(0xFF0D796F))),
        ]))),
      const SizedBox(height: 20),
      FutureBuilder<List<PendingReport>>(future: pending, builder: (context, snapshot) {
        final count = snapshot.data?.where((report) => report.receipt == null).length ?? 0;
        final photos = snapshot.data?.where((report) => report.receipt != null).length ?? 0;
        if (count == 0 && photos == 0) return const MessageCard(message: 'Los reportes confirmados reciben una referencia para seguimiento.');
        return Card(color: const Color(0xFFFFF1D9), child: Padding(padding: const EdgeInsets.all(16), child: Column(
          crossAxisAlignment: CrossAxisAlignment.start, children: [
            if (count > 0) Text('$count reporte(s) pendiente(s) de envío', style: const TextStyle(fontWeight: FontWeight.bold)),
            if (count > 0) const Text('Aún no han sido recibidos por la institución.'),
            if (photos > 0) Text('$photos foto(s) pendiente(s) de subir; el reporte ya tiene referencia.'),
            TextButton.icon(onPressed: retry, icon: const Icon(Icons.refresh), label: const Text('Reintentar ahora')),
          ])));
      }),
      const SizedBox(height: 14),
      const MessageCard(icon: Icons.shield_outlined, message: 'Piloto con datos DEMO ficticios. Para una emergencia real, llama al servicio correspondiente.'),
    ])),
  ]);
}
