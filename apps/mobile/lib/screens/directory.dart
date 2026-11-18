import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../core/api.dart';
import '../core/national_contacts_cache.dart';
import 'common.dart';
import 'district_selector.dart';

class DirectoryScreen extends StatefulWidget {
  const DirectoryScreen({super.key, required this.api});
  final ApiClient api;
  @override
  State<DirectoryScreen> createState() => _DirectoryScreenState();
}

class _DirectoryScreenState extends State<DirectoryScreen> {
  final search = TextEditingController();
  final cache = NationalContactsCache();
  static const fallback = <Map<String, dynamic>>[
    {'name': 'Policía Nacional', 'phone': '105', 'scope': 'national'},
    {'name': 'Bomberos', 'phone': '116', 'scope': 'national'},
    {'name': 'SAMU', 'phone': '106', 'scope': 'national'},
    {'name': 'Línea 100', 'phone': '100', 'scope': 'national'},
  ];
  List<Map<String, dynamic>> nationals = fallback;
  List<Map<String, dynamic>> locals = [];
  int? districtId;
  bool loading = true;
  bool offline = true;
  String? updatedAt;
  String? error;
  int generation = 0;

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    search.dispose();
    super.dispose();
  }

  Future<void> load() async {
    final current = ++generation;
    setState(() {
      loading = true;
      error = null;
      locals = [];
    });
    try {
      final saved = await cache.read();
      if (!mounted || current != generation) return;
      if (saved != null) {
        setState(() {
          nationals = List<Map<String, dynamic>>.from(saved['entries'] as List);
          updatedAt = saved['updatedAt'] as String;
        });
      }
    } catch (_) {
      if (mounted && current == generation) {
        setState(
          () => error = 'No se pudieron leer los contactos almacenados.',
        );
      }
    }
    if (!mounted || current != generation) return;
    try {
      final path = Uri(
        path: '/public/directory',
        queryParameters: districtId == null
            ? null
            : {'districtId': '$districtId'},
      ).toString();
      final entries = await widget.api.list(path);
      if (!mounted || current != generation) return;
      final nationalEntries = entries
          .where((entry) => entry['scope'] == 'national')
          .toList();
      setState(() {
        nationals = nationalEntries;
        locals = entries.where((entry) => entry['scope'] == 'local').toList();
        updatedAt = DateTime.now().toUtc().toIso8601String();
        offline = false;
        error = null;
      });
      try {
        await cache.save(nationalEntries);
      } catch (_) {
        if (mounted && current == generation) {
          setState(
            () => error =
                'Contactos actualizados. No se pudo guardar la copia sin conexión.',
          );
        }
      }
    } catch (_) {
      if (mounted && current == generation) {
        setState(() {
          offline = true;
          error =
              'No se pudieron actualizar los contactos. Se muestran los nacionales disponibles sin conexión.';
        });
      }
    } finally {
      if (mounted && current == generation) setState(() => loading = false);
    }
  }

  Future<void> call(String phone) async {
    try {
      if (await launchUrl(Uri(scheme: 'tel', path: phone))) return;
    } catch (_) {
      /* The platform can reject the dialer request. */
    }
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No se pudo abrir el marcador.')),
      );
    }
  }

  Widget contact(Map<String, dynamic> entry) => Card(
    child: ListTile(
      leading: const Icon(Icons.local_phone_outlined),
      title: Text(entry['name'] as String),
      subtitle: Text(
        [
          entry['phone'],
          entry['institutionName'],
          entry['siteName'],
          entry['scope'] == 'national'
              ? 'Nacional'
              : entry['districtName'] ?? 'Local',
        ].whereType<String>().join(' · '),
      ),
      trailing: IconButton(
        tooltip: 'Llamar al ${entry['phone']}',
        onPressed: () => call(entry['phone'] as String),
        icon: const Icon(Icons.call),
      ),
    ),
  );

  @override
  Widget build(BuildContext context) {
    final query = search.text.trim().toLowerCase();
    final matchingNationals = nationals.where(
      (entry) => entry['name'].toString().toLowerCase().contains(query),
    );
    final matchingLocals = locals.where(
      (entry) => entry['name'].toString().toLowerCase().contains(query),
    );
    return ListView(
      children: [
        ScreenPadding(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Contactos de emergencia',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const Text(
                'Toca un teléfono para abrir el marcador y confirmar la llamada.',
              ),
              const SizedBox(height: 16),
              DistrictSelector(
                api: widget.api,
                value: districtId,
                onChanged: (value) {
                  setState(() => districtId = value);
                  load();
                },
              ),
              const SizedBox(height: 12),
              TextField(
                controller: search,
                onChanged: (_) => setState(() {}),
                decoration: const InputDecoration(
                  labelText: 'Buscar por nombre',
                  prefixIcon: Icon(Icons.search),
                ),
              ),
              if (loading) const LinearProgressIndicator(),
              if (error != null) MessageCard(message: error!),
              TextButton(
                onPressed: load,
                child: const Text('Actualizar contactos'),
              ),
              Text(
                updatedAt == null
                    ? 'Números nacionales de respaldo'
                    : '${offline ? 'Copia almacenada' : 'Actualizado'} · ${formatDate(updatedAt)}',
              ),
              const SizedBox(height: 12),
              Text(
                'Contactos nacionales',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              ...matchingNationals.map(contact),
              if (matchingNationals.isEmpty)
                const Text('No hay contactos nacionales que coincidan.'),
              const SizedBox(height: 16),
              Text(
                'Contactos del distrito',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              if (districtId == null)
                const Text(
                  'Selecciona un distrito para consultar sus contactos locales.',
                )
              else
                ...matchingLocals.map(contact),
              if (districtId != null &&
                  !loading &&
                  !offline &&
                  matchingLocals.isEmpty)
                const Text('No hay contactos locales para estos filtros.'),
              const SizedBox(height: 16),
              const Text(
                'Llamar abre el marcador. La llamada requiere servicio telefónico.',
              ),
              TextButton.icon(
                onPressed: () async {
                  final opened = await launchUrl(
                    Uri.parse('https://www.gob.pe/547-telefonos-de-emergencia'),
                    mode: LaunchMode.externalApplication,
                  );
                  if (!opened && context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                      content: Text('No se pudo abrir la referencia oficial.'),
                    ));
                  }
                },
                icon: const Icon(Icons.open_in_new),
                label: const Text('Referencia oficial: Gob.pe'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
