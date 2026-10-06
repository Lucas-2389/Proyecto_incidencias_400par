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
  final district = TextEditingController();
  late Future<List<Map<String, dynamic>>> contacts = load();
  Future<List<Map<String, dynamic>>> load() => widget.api.list(
    '/public/directory${district.text.isEmpty ? '' : '?districtId=${district.text.trim()}'}');
  @override
  void dispose() { district.dispose(); super.dispose(); }
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
      const Text('Números nacionales y contactos locales configurados.'),
      Row(children: [Expanded(child: TextField(controller: district, keyboardType: TextInputType.number,
        decoration: const InputDecoration(labelText: 'Distrito ID (opcional)'))),
        IconButton(onPressed: () => setState(() => contacts = load()), icon: const Icon(Icons.search), tooltip: 'Buscar contactos')]),
      FutureBuilder<List<Map<String, dynamic>>>(future: contacts, builder: (context, snapshot) {
        if (snapshot.hasError) return MessageCard(message: 'No se pudo cargar el directorio: ${snapshot.error}');
        if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
        if (snapshot.data!.isEmpty) return const MessageCard(message: 'No hay contactos activos configurados.');
        return Column(children: snapshot.data!.map((entry) => Card(child: ListTile(
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
