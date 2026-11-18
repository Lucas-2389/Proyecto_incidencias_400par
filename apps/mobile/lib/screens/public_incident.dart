import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/public_favorites.dart';
import 'common.dart';
import 'mine.dart' show incidentStatus;

String publicCategory(int? id, List<Map<String, dynamic>> categories) {
  for (final category in categories) {
    if (category['id'] == id) return category['name'] as String;
  }
  return 'Incidente';
}

class PublicIncidentSheet extends StatefulWidget {
  const PublicIncidentSheet({
    super.key,
    required this.api,
    required this.id,
    required this.categories,
    required this.favorites,
  });
  final ApiClient api;
  final String id;
  final List<Map<String, dynamic>> categories;
  final PublicFavorites favorites;
  @override
  State<PublicIncidentSheet> createState() => _PublicIncidentSheetState();
}

class _PublicIncidentSheetState extends State<PublicIncidentSheet> {
  Map<String, dynamic>? incident;
  bool loading = true;
  bool unavailable = false;
  bool saving = false;
  String? error;
  String? saveError;
  @override
  void initState() {
    super.initState();
    refresh();
  }

  Future<void> refresh() async {
    setState(() {
      loading = true;
      incident = null;
      error = null;
      unavailable = false;
    });
    try {
      final result = await widget.api.request(
        'GET',
        '/public/incidents/${widget.id}',
        auth: false,
      );
      if (mounted) {
        setState(() => incident = Map<String, dynamic>.from(result as Map));
      }
    } catch (issue) {
      if (!mounted) return;
      setState(() {
        unavailable = issue is ApiException && issue.status == 404;
        if (!unavailable) error = 'No se pudo actualizar. Reintenta.';
      });
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> save(bool saved) async {
    setState(() {
      saving = true;
      saveError = null;
    });
    try {
      await widget.favorites.setSaved(widget.id, saved);
    } catch (_) {
      if (mounted) {
        setState(() => saveError = 'No se pudo guardar el cambio. Reintenta.');
      }
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) => SafeArea(
    child: RefreshIndicator(
      onRefresh: refresh,
      child: ListView(
        shrinkWrap: true,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(20),
        children: [
          if (loading) const Center(child: CircularProgressIndicator()),
          if (unavailable) const MessageCard(message: 'No disponible'),
          if (error != null) MessageCard(message: error!),
          if (incident != null) ...[
            Text(
              incident!['reference'] as String,
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 12),
            Text(
              publicCategory(
                incident!['categoryId'] as int?,
                widget.categories,
              ),
            ),
            Text('Estado: ${incidentStatus(incident!['status'])}'),
            Text('Fecha: ${formatDate(incident!['createdAt'])}'),
            const Text('Ubicación aproximada'),
          ],
          if (!loading)
            TextButton.icon(
              onPressed: refresh,
              icon: const Icon(Icons.refresh),
              label: const Text('Actualizar estado'),
            ),
          if (saveError != null) MessageCard(message: saveError!),
          ListenableBuilder(
            listenable: widget.favorites,
            builder: (context, _) {
              final saved = widget.favorites.contains(widget.id);
              if (incident == null && !saved) return const SizedBox.shrink();
              return FilledButton.icon(
                onPressed: saving ? null : () => save(!saved),
                icon: Icon(saved ? Icons.star : Icons.star_border),
                label: Text(saved ? 'Quitar favorito' : 'Guardar favorito'),
              );
            },
          ),
        ],
      ),
    ),
  );
}

class PublicFavoritesScreen extends StatefulWidget {
  const PublicFavoritesScreen({
    super.key,
    required this.api,
    required this.favorites,
    required this.categories,
  });
  final ApiClient api;
  final PublicFavorites favorites;
  final List<Map<String, dynamic>> categories;
  @override
  State<PublicFavoritesScreen> createState() => _PublicFavoritesScreenState();
}

class _PublicFavoritesScreenState extends State<PublicFavoritesScreen> {
  final results = <String, Map<String, dynamic>>{};
  final errors = <String, String>{};
  bool loading = true;
  String? storageError;
  int generation = 0;
  @override
  void initState() {
    super.initState();
    widget.favorites.addListener(changed);
    refresh();
  }

  @override
  void dispose() {
    widget.favorites.removeListener(changed);
    super.dispose();
  }

  void changed() {
    if (mounted) setState(() {});
  }

  Future<void> refresh() async {
    final current = ++generation;
    setState(() {
      loading = true;
      storageError = null;
      results.clear();
      errors.clear();
    });
    try {
      await widget.favorites.load();
      final ids = widget.favorites.ids;
      // Lotes pequeños limitan las consultas simultáneas y mantienen errores por fila.
      for (var start = 0; start < ids.length; start += 4) {
        if (!mounted || current != generation) return;
        await Future.wait(
          ids.skip(start).take(4).map((id) async {
            try {
              final result = await widget.api.request(
                'GET',
                '/public/incidents/$id',
                auth: false,
              );
              if (mounted && current == generation) {
                setState(
                  () => results[id] = Map<String, dynamic>.from(result as Map),
                );
              }
            } catch (issue) {
              if (mounted && current == generation) {
                setState(
                  () =>
                      errors[id] = issue is ApiException && issue.status == 404
                      ? 'No disponible'
                      : 'No se pudo actualizar. Reintenta.',
                );
              }
            }
          }),
        );
      }
    } catch (_) {
      if (mounted && current == generation) {
        setState(
          () => storageError = 'No se pudieron leer los favoritos locales.',
        );
      }
    } finally {
      if (mounted && current == generation) setState(() => loading = false);
    }
  }

  Future<void> remove(String id) async {
    try {
      await widget.favorites.setSaved(id, false);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No se pudo quitar el favorito.')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Favoritos')),
    body: RefreshIndicator(
      onRefresh: refresh,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        children: [
          if (loading) const LinearProgressIndicator(),
          if (storageError != null) ...[
            MessageCard(message: storageError!),
            TextButton(onPressed: refresh, child: const Text('Reintentar')),
            TextButton(
              onPressed: () async {
                try {
                  await widget.favorites.reset();
                  await refresh();
                } catch (_) {
                  if (mounted) {
                    setState(
                      () => storageError =
                          'No se pudieron restablecer los favoritos.',
                    );
                  }
                }
              },
              child: const Text('Restablecer favoritos locales'),
            ),
          ],
          if (!loading && storageError == null && widget.favorites.ids.isEmpty)
            const MessageCard(
              message:
                  'Aún no tienes favoritos. Guarda un incidente desde el mapa.',
            ),
          for (final id in widget.favorites.ids)
            Card(
              child: ListTile(
                title: Text(
                  results[id]?['reference'] as String? ?? 'Reporte guardado',
                ),
                subtitle: Text(
                  results[id] != null
                      ? incidentStatus(results[id]!['status'])
                      : errors[id] ?? 'Actualizando…',
                ),
                onTap: () async {
                  await showModalBottomSheet<void>(
                    context: context,
                    isScrollControlled: true,
                    builder: (_) => PublicIncidentSheet(
                      api: widget.api,
                      id: id,
                      categories: widget.categories,
                      favorites: widget.favorites,
                    ),
                  );
                  if (mounted) await refresh();
                },
                trailing: IconButton(
                  tooltip: 'Quitar favorito',
                  onPressed: () => remove(id),
                  icon: const Icon(Icons.star),
                ),
              ),
            ),
          if (!loading && widget.favorites.ids.isNotEmpty)
            TextButton.icon(
              onPressed: refresh,
              icon: const Icon(Icons.refresh),
              label: const Text('Actualizar favoritos'),
            ),
        ],
      ),
    ),
  );
}
