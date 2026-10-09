import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/api.dart';
import 'common.dart';

class DirectoryScreen extends StatefulWidget {
  const DirectoryScreen({super.key, required this.api});
  final ApiClient api;
  @override
  State<DirectoryScreen> createState() => _DirectoryScreenState();
}

class _DirectoryScreenState extends State<DirectoryScreen> {
  final search = TextEditingController();
  late Future<List<Map<String, dynamic>>> contacts = load();
  Future<List<Map<String, dynamic>>> load() => widget.api.list('/public/directory');
  @override
  void dispose() { search.dispose(); super.dispose(); }
  Future<void> call(String phone) async {
    final uri = Uri(scheme: 'tel', path: phone);
    if (!await launchUrl(uri) && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('No se pudo abrir el marcador.')));
    }
  }
  @override
  Widget build(BuildContext context) => ListView(children: [ScreenPadding(child: Column(
    crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('Directorio de emergencias', style: Theme.of(context).textTheme.headlineSmall),
      const Text('Sin cuenta. Toca un número para abrir el marcador y confirmar la llamada.'),
      const SizedBox(height: 16),
      for (final contact in [
        ('105', 'Policía Nacional', 'Seguridad y emergencias policiales', Icons.local_police_rounded, const Color(0xFF365CC9)),
        ('116', 'Bomberos', 'Incendios y rescates', Icons.local_fire_department_rounded, const Color(0xFFB64930)),
        ('106', 'SAMU', 'Urgencias médicas · cobertura según región', Icons.emergency_rounded, const Color(0xFF087C72)),
        ('100', 'Línea 100', 'Orientación ante violencia familiar y sexual', Icons.support_agent_rounded, const Color(0xFF9255AD)),
      ]) Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(
        crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [Icon(contact.$4, color: contact.$5, size: 30), const SizedBox(width: 12),
            Expanded(child: Text(contact.$2, style: const TextStyle(fontSize: 19, fontWeight: FontWeight.bold)))]),
          const SizedBox(height: 8), Text(contact.$3), const SizedBox(height: 12),
          FilledButton.icon(style: FilledButton.styleFrom(backgroundColor: contact.$5),
            onPressed: () => call(contact.$1), icon: const Icon(Icons.call), label: Text('Llamar al ${contact.$1}')),
        ]))),
      const SizedBox(height: 8),
      TextButton.icon(onPressed: () async {
        final opened = await launchUrl(Uri.parse('https://www.gob.pe/547-telefonos-de-emergencia'), mode: LaunchMode.externalApplication);
        if (!opened && context.mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('No se pudo abrir la referencia oficial.')));
      }, icon: const Icon(Icons.open_in_new), label: const Text('Referencia oficial: Gob.pe')),
      const MessageCard(icon: Icons.offline_bolt_outlined,
        message: 'Los números de arriba se muestran incluso sin Internet. La llamada requiere servicio telefónico. Serenazgo depende de tu municipalidad.'),
      const SizedBox(height: 20), Text('Contactos del piloto', style: Theme.of(context).textTheme.titleLarge),
      const SizedBox(height: 10),
      TextField(controller: search, onChanged: (_) => setState(() {}),
        decoration: const InputDecoration(labelText: 'Buscar por nombre', prefixIcon: Icon(Icons.search))),
      FutureBuilder<List<Map<String, dynamic>>>(future: contacts, builder: (context, snapshot) {
        if (snapshot.hasError) return MessageCard(message: 'No se pudieron cargar los contactos del piloto. Los números oficiales de arriba siguen disponibles.');
        if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
        if (snapshot.data!.isEmpty) return const MessageCard(message: 'No hay contactos activos configurados.');
        final entries = snapshot.data!.where((entry) => entry['scope'] != 'national' &&
          entry['name'].toString().toLowerCase().contains(search.text.trim().toLowerCase())).toList();
        if (entries.isEmpty) return const MessageCard(message: 'No hay contactos locales que coincidan.');
        return Column(children: entries.map((entry) => Card(child: ListTile(
          leading: const Icon(Icons.local_phone_outlined), title: Text(entry['name'] as String),
          subtitle: Text('${entry['phone']} · ${entry['scope'] == 'national' ? 'Nacional' : 'Local'}'),
          trailing: FilledButton.tonalIcon(onPressed: () => call(entry['phone'] as String),
            icon: const Icon(Icons.call), label: const Text('Llamar')),
        ))).toList());
      }),
      const SizedBox(height: 8), const Text('Llamar abre el marcador. La app nunca realiza llamadas automáticamente.',
        style: TextStyle(fontSize: 12)),
    ]))]);
}
