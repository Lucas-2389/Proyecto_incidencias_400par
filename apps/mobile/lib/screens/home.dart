import 'package:flutter/material.dart';
import 'dart:io';

import '../core/pending.dart';
import '../core/app_theme.dart';
import 'common.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({
    super.key,
    required this.pending,
    required this.onReport,
    required this.onRetry,
    this.onNavigate,
  });
  final void Function(int)? onNavigate;
  final PendingRepository pending;
  final VoidCallback onReport;
  final Future<void> Function() onRetry;
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late Future<List<PendingReport>> pending = widget.pending.all();
  Future<void> retry() async {
    await widget.onRetry();
    setState(() => pending = widget.pending.all());
  }

  Future<void> discardPhoto(PendingReport report) async {
    final confirmed = await showDialog<bool>(context: context, builder: (context) => AlertDialog(
      title: const Text('¿Descartar esta foto pendiente?'),
      content: Text('Se eliminará únicamente la copia pendiente del celular. El reporte ${report.receipt?['reference'] ?? ''} recibido por la institución se conserva.'),
      actions: [TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Conservar')),
        TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Descartar foto'))],
    ));
    if (confirmed != true) return;
    await widget.pending.remove(report.clientRequestId);
    if (report.photoPath != null) {
      try { await File(report.photoPath!).delete(); } catch (_) { /* La copia puede no existir. */ }
    }
    if (!mounted) return;
    setState(() => pending = widget.pending.all());
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Foto pendiente descartada. El reporte recibido se conserva.')));
  }

  @override
  Widget build(BuildContext context) => ListView(
    children: [
      ScreenPadding(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 12),
            const Chip(
              avatar: Icon(Icons.favorite_rounded, size: 18),
              label: Text('Juntos cuidamos Ayacucho'),
            ),
            const SizedBox(height: 12),
            Text(
              'Tu comunidad, más segura',
              style: Theme.of(
                context,
              ).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            const Text(
              'Comunica lo que sucede y recibe una referencia de envío. Sin registro ni contraseña.',
            ),
            const SizedBox(height: 22),
            Container(
              decoration: BoxDecoration(
                color: AppColors.blue,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Padding(
                padding: const EdgeInsets.all(22),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(
                      Icons.health_and_safety_rounded,
                      color: Colors.white,
                      size: 54,
                    ),
                    const SizedBox(height: 14),
                    const Text(
                      '¿Necesitas reportar?',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'Cuéntanos qué pasó, marca el lugar y añade una foto si puedes. Sin necesidad de una cuenta.',
                      style: TextStyle(color: Colors.white),
                    ),
                    const SizedBox(height: 18),
                    FilledButton.icon(
                      onPressed: widget.onReport,
                      icon: const Icon(Icons.arrow_forward),
                      label: const Text('Crear reporte'),
                      style: FilledButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: AppColors.blue,
                      ),
                    ),
                    const SizedBox(height: 10),
                    OutlinedButton.icon(
                      onPressed: widget.onNavigate == null
                          ? null
                          : () => widget.onNavigate!(3),
                      icon: const Icon(Icons.phone_in_talk_outlined),
                      label: const Text('Teléfonos de emergencia'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.white,
                        side: const BorderSide(color: Colors.white),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 26),
            Text(
              '¿Qué necesitas hacer?',
              style: Theme.of(
                context,
              ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 10),
            LayoutBuilder(
              builder: (context, constraints) => Wrap(
                spacing: 12,
                runSpacing: 12,
                children: [
                  for (final action in [
                    (
                      Icons.map_rounded,
                      'Ver el mapa',
                      'Ubica los reportes',
                      AppColors.blue,
                      2,
                    ),
                    (
                      Icons.call_rounded,
                      'Buscar ayuda',
                      'Abre los contactos',
                      AppColors.blue,
                      3,
                    ),
                    (
                      Icons.notifications_active_rounded,
                      'Ver alertas',
                      'Información vigente',
                      AppColors.blue,
                      4,
                    ),
                    (
                      Icons.info_rounded,
                      'Conoce la app',
                      'Reportar es sencillo',
                      AppColors.blue,
                      5,
                    ),
                  ])
                    SizedBox(
                      width: constraints.maxWidth < 280
                          ? constraints.maxWidth
                          : (constraints.maxWidth - 12) / 2,
                      child: Material(
                        color: action.$4.withValues(alpha: .05),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(18),
                          side: const BorderSide(color: AppColors.line),
                        ),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(22),
                          onTap: widget.onNavigate == null
                              ? null
                              : () => widget.onNavigate!(action.$5),
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: action.$4.withValues(alpha: .12),
                                    borderRadius: BorderRadius.circular(16),
                                  ),
                                  child: Icon(
                                    action.$1,
                                    color: action.$4,
                                    size: 28,
                                  ),
                                ),
                                const SizedBox(height: 12),
                                Text(
                                  action.$2,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w800,
                                    fontSize: 16,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  action.$3,
                                  style: const TextStyle(
                                    color: Color(0xFF526B76),
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Icon(
                                  Icons.arrow_forward_rounded,
                                  color: action.$4,
                                  size: 20,
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            FutureBuilder<List<PendingReport>>(
              future: pending,
              builder: (context, snapshot) {
                final count =
                    snapshot.data
                        ?.where((report) => report.receipt == null)
                        .length ??
                    0;
                final photos =
                    snapshot.data
                        ?.where((report) => report.receipt != null)
                        .length ??
                    0;
                if (count == 0 && photos == 0) {
                  return const MessageCard(
                    message:
                        'Conserva tu referencia de recepción. El personal autorizado realiza el seguimiento desde el panel institucional.',
                  );
                }
                return Card(
                  color: const Color(0xFFFFF1D9),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (count > 0)
                          Text(
                            '$count reporte(s) pendiente(s) de envío',
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                        if (count > 0)
                          const Text(
                            'Aún no han sido recibidos por la institución.',
                          ),
                        if (photos > 0)
                          Text(
                            '$photos foto(s) pendiente(s) de subir; el reporte ya tiene referencia.',
                          ),
                        TextButton.icon(
                          onPressed: retry,
                          icon: const Icon(Icons.refresh),
                          label: const Text('Reintentar ahora'),
                        ),
                        for (final report in snapshot.data ?? <PendingReport>[])
                          if (report.receipt != null)
                            TextButton.icon(onPressed: () => discardPhoto(report),
                              icon: const Icon(Icons.delete_outline),
                              label: Text('Descartar foto · ${report.receipt?['reference'] ?? 'Reporte recibido'}')),
                      ],
                    ),
                  ),
                );
              },
            ),
            const SizedBox(height: 14),
            const MessageCard(
              icon: Icons.shield_outlined,
              message:
                  'Entorno local de evaluación. Los reportes llegan al panel de esta PC. Para una emergencia real, llama al servicio correspondiente.',
            ),
          ],
        ),
      ),
    ],
  );
}
