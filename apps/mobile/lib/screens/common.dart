import 'package:flutter/material.dart';

class ScreenPadding extends StatelessWidget {
  const ScreenPadding({super.key, required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) => Padding(padding: const EdgeInsets.all(16), child: child);
}

class MessageCard extends StatelessWidget {
  const MessageCard({super.key, required this.message, this.icon = Icons.info_outline});
  final String message;
  final IconData icon;
  @override
  Widget build(BuildContext context) => Card(child: Padding(padding: const EdgeInsets.all(16), child: Row(children: [
    Icon(icon, color: Theme.of(context).colorScheme.primary), const SizedBox(width: 12),
    Expanded(child: Text(message)),
  ])));
}

String formatDate(dynamic value) {
  if (value is! String) return '—';
  final parsed = DateTime.tryParse(value);
  if (parsed == null) return value;
  final local = parsed.toLocal();
  return '${local.day.toString().padLeft(2, '0')}/${local.month.toString().padLeft(2, '0')}/${local.year} '
      '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
}
