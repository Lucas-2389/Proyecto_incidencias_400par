import 'package:flutter/material.dart';
import '../core/api.dart';
import '../core/territory.dart';

class DistrictSelector extends StatefulWidget {
  const DistrictSelector({
    super.key,
    required this.api,
    required this.value,
    required this.onChanged,
  });
  final ApiClient api;
  final int? value;
  final ValueChanged<int?> onChanged;
  @override
  State<DistrictSelector> createState() => _DistrictSelectorState();
}

class _DistrictSelectorState extends State<DistrictSelector> {
  late Future<List<Map<String, dynamic>>> districts = widget.api.list(
    metropolitanDistrictsPath,
  );
  @override
  Widget build(BuildContext context) =>
      FutureBuilder<List<Map<String, dynamic>>>(
        future: districts,
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return Row(
              children: [
                const Expanded(
                  child: Text('No se pudieron cargar los distritos.'),
                ),
                TextButton(
                  onPressed: () => setState(() {
                    districts = widget.api.list(metropolitanDistrictsPath);
                  }),
                  child: const Text('Reintentar distritos'),
                ),
              ],
            );
          }
          return DropdownButtonFormField<int>(
            key: ValueKey('district-${widget.value}'),
            initialValue: widget.value,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Distrito'),
            items: [
              const DropdownMenuItem<int>(value: null, child: Text('Todos')),
              for (final district in snapshot.data ?? <Map<String, dynamic>>[])
                DropdownMenuItem(
                  value: district['id'] as int,
                  child: Text(
                    district['name'] as String,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
            ],
            onChanged: snapshot.hasData ? widget.onChanged : null,
          );
        },
      );
}
