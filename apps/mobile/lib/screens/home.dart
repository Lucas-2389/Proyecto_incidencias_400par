import 'package:flutter/material.dart';

import '../core/pending.dart';
import 'common.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.pending, required this.onReport, required this.onRetry, this.onNavigate});
  final void Function(int)? onNavigate;
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
      const SizedBox(height: 12),
      const Chip(avatar: Icon(Icons.favorite_rounded, size: 18), label: Text('Juntos cuidamos Ayacucho')),
      const SizedBox(height: 12),
      Text('Tu comunidad, más segura', style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold)),
      const SizedBox(height: 8), const Text('Comunica lo que sucede y recibe una referencia de envío. Sin registro ni contraseña.'),
      const SizedBox(height: 22),
      Container(decoration: BoxDecoration(
        gradient: const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight,
          colors: [Color(0xFF123B46), Color(0xFF087C72), Color(0xFF209B86)]),
        borderRadius: BorderRadius.circular(26),
        boxShadow: const [BoxShadow(color: Color(0x26087C72), blurRadius: 20, offset: Offset(0, 8))]), child: Padding(padding: const EdgeInsets.all(22), child: Column(
        crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Icon(Icons.health_and_safety_rounded, color: Color(0xFFAFF4DA), size: 54), const SizedBox(height: 14),
          const Text('¿Necesitas reportar?', style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold)),
          const SizedBox(height: 6), const Text('Cuéntanos qué pasó, marca el lugar y añade una foto si puedes. Sin necesidad de una cuenta.',
            style: TextStyle(color: Colors.white)), const SizedBox(height: 18),
          FilledButton.icon(onPressed: widget.onReport, icon: const Icon(Icons.arrow_forward), label: const Text('Crear reporte'),
            style: FilledButton.styleFrom(backgroundColor: Colors.white, foregroundColor: const Color(0xFF0D796F))),
        ]))),
      const SizedBox(height: 26),
      Text('¿Qué necesitas hacer?', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
      const SizedBox(height: 10),
      LayoutBuilder(builder: (context, constraints) => Wrap(spacing: 12, runSpacing: 12, children: [
        for (final action in [
          (Icons.map_rounded, 'Ver el mapa', 'Ubica los reportes', const Color(0xFF365CC9), 2),
          (Icons.call_rounded, 'Buscar ayuda', 'Teléfonos de emergencia', const Color(0xFFB64930), 3),
          (Icons.notifications_active_rounded, 'Ver alertas', 'Información vigente', const Color(0xFF9255AD), 4),
          (Icons.info_rounded, 'Conoce la app', 'Reportar es sencillo', const Color(0xFF087C72), 5),
        ]) SizedBox(width: constraints.maxWidth < 280 ? constraints.maxWidth : (constraints.maxWidth - 12) / 2,
          child: Material(color: Colors.white, borderRadius: BorderRadius.circular(22),
            child: InkWell(borderRadius: BorderRadius.circular(22),
              onTap: widget.onNavigate == null ? null : () => widget.onNavigate!(action.$5),
              child: Padding(padding: const EdgeInsets.all(16), child: Column(
                crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Container(padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: action.$4.withValues(alpha: .12), borderRadius: BorderRadius.circular(16)),
                    child: Icon(action.$1, color: action.$4, size: 28)),
                  const SizedBox(height: 12), Text(action.$2, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                  const SizedBox(height: 4), Text(action.$3, style: const TextStyle(color: Color(0xFF526B76))),
                  const SizedBox(height: 8), Icon(Icons.arrow_forward_rounded, color: action.$4, size: 20),
                ]))))),
      ])),
      const SizedBox(height: 20),
      FutureBuilder<List<PendingReport>>(future: pending, builder: (context, snapshot) {
        final count = snapshot.data?.where((report) => report.receipt == null).length ?? 0;
        final photos = snapshot.data?.where((report) => report.receipt != null).length ?? 0;
        if (count == 0 && photos == 0) return const MessageCard(message: 'Conserva tu referencia de recepción. El personal autorizado realiza el seguimiento desde el panel institucional.');
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
