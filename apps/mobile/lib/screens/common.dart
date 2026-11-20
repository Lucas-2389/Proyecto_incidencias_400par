import 'package:flutter/material.dart';
import '../core/app_theme.dart';

class ScreenIntro extends StatelessWidget {
  const ScreenIntro({
    super.key,
    required this.title,
    required this.message,
    required this.icon,
  });
  final String title;
  final String message;
  final IconData icon;
  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    margin: const EdgeInsets.only(bottom: 16),
    padding: const EdgeInsets.all(18),
    decoration: const BoxDecoration(
      color: Colors.white,
      border: Border(
        left: BorderSide(color: AppColors.blue, width: 4),
        bottom: BorderSide(color: AppColors.line),
      ),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: AppColors.blue, size: 30),
        const SizedBox(height: 12),
        Text(
          title,
          style: Theme.of(
            context,
          ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 8),
        Text(message, style: const TextStyle(height: 1.5)),
      ],
    ),
  );
}

class ScreenPadding extends StatelessWidget {
  const ScreenPadding({super.key, required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) =>
      Padding(padding: const EdgeInsets.all(16), child: child);
}

class MessageCard extends StatelessWidget {
  const MessageCard({
    super.key,
    required this.message,
    this.icon = Icons.info_outline,
  });
  final String message;
  final IconData icon;
  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(9),
            decoration: BoxDecoration(
              color: AppColors.blue.withValues(alpha: .08),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: Theme.of(context).colorScheme.primary),
          ),
          const SizedBox(width: 12),
          Expanded(child: Text(message)),
        ],
      ),
    ),
  );
}

String formatDate(dynamic value) {
  if (value is! String) return '—';
  final parsed = DateTime.tryParse(value);
  if (parsed == null) return value;
  final local = parsed.toLocal();
  return '${local.day.toString().padLeft(2, '0')}/${local.month.toString().padLeft(2, '0')}/${local.year} '
      '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
}

String? validateContactPhone(String? value) {
  final phone = value?.trim() ?? '';
  if (phone.isEmpty) return null;
  final digits = phone.replaceAll(RegExp(r'\D'), '');
  if (!RegExp(r'^\+?[0-9 ()-]{7,20}$').hasMatch(phone) ||
      digits.length < 7 ||
      digits.length > 15) {
    return 'Escribe un teléfono válido o deja el campo vacío';
  }
  return null;
}
