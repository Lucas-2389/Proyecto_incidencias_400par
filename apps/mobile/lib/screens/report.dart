import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:latlong2/latlong.dart';
import 'package:path_provider/path_provider.dart';
import 'package:uuid/uuid.dart';

import '../core/api.dart';
import '../core/config.dart';
import '../core/pending.dart';
import 'common.dart';

class LocationFix {
  const LocationFix(this.latitude, this.longitude, this.accuracyMeters, this.capturedAt);
  final double latitude;
  final double longitude;
  final double accuracyMeters;
  final DateTime capturedAt;
}

Future<LocationFix> readDeviceLocation() async {
  if (!await Geolocator.isLocationServiceEnabled()) {
    throw Exception('Activa el GPS o elige la ubicación manualmente.');
  }
  var permission = await Geolocator.checkPermission();
  if (permission == LocationPermission.denied) permission = await Geolocator.requestPermission();
  if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
    throw Exception('Permiso de ubicación denegado. Puedes marcar el punto en el mapa.');
  }
  final position = await Geolocator.getCurrentPosition(
    locationSettings: const LocationSettings(accuracy: LocationAccuracy.high));
  return LocationFix(position.latitude, position.longitude, position.accuracy, position.timestamp);
}

class ReportScreen extends StatefulWidget {
  const ReportScreen({super.key, required this.api, required this.submissions, this.locationReader = readDeviceLocation});
  final ApiClient api;
  final SubmissionService submissions;
  final Future<LocationFix> Function() locationReader;
  @override
  State<ReportScreen> createState() => _ReportScreenState();
}

class _ReportScreenState extends State<ReportScreen> {
  final form = GlobalKey<FormState>();
  final map = MapController();
  final description = TextEditingController();
  final latitude = TextEditingController();
  final longitude = TextEditingController();
  late Future<List<Map<String, dynamic>>> categories = widget.api.list('/catalog/categories');
  int? categoryId;
  LatLng? point;
  double? accuracy;
  DateTime? capturedAt;
  String? photoPath;
  String? requestId;
  Map<String, dynamic>? receipt;
  String? error;
  String? photoError;
  bool pending = false;
  bool busy = false;
  @override
  void dispose() { description.dispose(); latitude.dispose(); longitude.dispose(); map.dispose(); super.dispose(); }

  void choosePoint(LatLng selected, {double? accuracyMeters, DateTime? at}) {
    if (selected.latitude < -90 || selected.latitude > 90 || selected.longitude < -180 || selected.longitude > 180) return;
    setState(() { point = selected; accuracy = accuracyMeters; capturedAt = at; });
    latitude.text = selected.latitude.toStringAsFixed(6);
    longitude.text = selected.longitude.toStringAsFixed(6);
    map.move(selected, 15);
  }

  void manualPoint() {
    final lat = double.tryParse(latitude.text.replaceAll(',', '.'));
    final lng = double.tryParse(longitude.text.replaceAll(',', '.'));
    if (lat == null || lng == null || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setState(() => error = 'Introduce latitud y longitud válidas.');
      return;
    }
    choosePoint(LatLng(lat, lng));
  }

  Future<void> locate() async {
    try {
      final position = await widget.locationReader();
      if (!mounted) return;
      choosePoint(LatLng(position.latitude, position.longitude), accuracyMeters: position.accuracyMeters, at: position.capturedAt);
      setState(() => error = null);
    } catch (issue) { if (mounted) setState(() => error = issue.toString()); }
  }

  Future<void> pickPhoto(ImageSource source) async {
    try {
      final image = await ImagePicker().pickImage(source: source, imageQuality: 85);
      if (image == null) return;
      final extension = image.path.split('.').last.toLowerCase();
      final stored = File('${(await getApplicationSupportDirectory()).path}/${const Uuid().v4()}.$extension');
      await File(image.path).copy(stored.path);
      if (mounted) setState(() { photoPath = stored.path; photoError = null; });
    } catch (issue) { if (mounted) setState(() => error = 'No se pudo preparar la foto: $issue'); }
  }

  Future<void> submit() async {
    if (!form.currentState!.validate()) { return; }
    if (point == null || categoryId == null) { setState(() => error = 'Selecciona categoría y ubicación.'); return; }
    setState(() { busy = true; error = null; pending = false; receipt = null; photoError = null; });
    requestId ??= const Uuid().v4();
    final report = PendingReport(clientRequestId: requestId!, photoPath: photoPath,
      body: { 'categoryId': categoryId, 'description': description.text.trim(),
        'location': {'latitude': point!.latitude, 'longitude': point!.longitude,
          if (accuracy != null) 'accuracyMeters': accuracy,
          if (capturedAt != null) 'capturedAt': capturedAt!.toUtc().toIso8601String()} });
    try {
      final result = await widget.submissions.submit(report);
      if (!mounted) return;
      setState(() { receipt = result.receipt; pending = result.pending; photoError = result.photoError;
        busy = false; requestId = null;
        if (result.pending || result.receipt != null) {
          form.currentState?.reset(); description.clear(); categoryId = null; point = null;
          latitude.clear(); longitude.clear(); accuracy = null; capturedAt = null;
        }
        if (result.photoError == null) photoPath = null;
      });
    } catch (issue) { if (mounted) setState(() { error = issue.toString(); busy = false; }); }
  }

  Future<void> retryPhoto() async {
    if (receipt == null || photoPath == null) return;
    try {
      final queued = (await widget.submissions.repository.all()).where(
        (item) => item.receipt?['id'] == receipt!['id']).toList();
      if (queued.isEmpty) return;
      final result = await widget.submissions.submit(queued.first);
      if (mounted) setState(() { photoError = result.photoError; if (result.photoError == null) photoPath = null; });
    } catch (issue) { if (mounted) setState(() => photoError = issue.toString()); }
  }

  @override
  Widget build(BuildContext context) => ListView(children: [ScreenPadding(child: Column(
    crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('Nuevo reporte', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold)),
      const SizedBox(height: 8), const Text('Cuéntanos qué ocurre y confirma el punto exacto antes de enviar.'),
      if (pending) const MessageCard(icon: Icons.wifi_off, message: 'Pendiente de envío. Aún no fue recibido por la institución. Se reintentará con el mismo identificador.'),
      if (receipt != null) Card(color: const Color(0xFFE3F5EB), child: Padding(padding: const EdgeInsets.all(16), child: Column(
        crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Reporte confirmado', style: TextStyle(fontWeight: FontWeight.bold)),
          Text('Referencia: ${receipt!['reference']}'), Text('Estado: ${receipt!['status']}'),
        ]))),
      if (photoError != null) Column(children: [MessageCard(icon: Icons.photo_outlined,
        message: 'Reporte confirmado; la foto aún no se envió. $photoError'),
        TextButton(onPressed: retryPhoto, child: const Text('Reintentar foto'))]),
      if (error != null) MessageCard(icon: Icons.error_outline, message: error!),
      Form(key: form, child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const SizedBox(height: 18), FutureBuilder<List<Map<String, dynamic>>>(future: categories, builder: (context, snapshot) {
          if (snapshot.hasError) { return TextButton(onPressed: () => setState(() => categories = widget.api.list('/catalog/categories')),
            child: const Text('No se cargaron categorías. Reintentar')); }
          return DropdownButtonFormField<int>(initialValue: categoryId, decoration: const InputDecoration(labelText: 'Categoría'),
            items: (snapshot.data ?? []).map((item) => DropdownMenuItem(value: item['id'] as int, child: Text(item['name'] as String))).toList(),
            onChanged: (value) => setState(() => categoryId = value), validator: (value) => value == null ? 'Elige una categoría' : null);
        }),
        const SizedBox(height: 12), TextFormField(controller: description, maxLines: 3, maxLength: 2000,
          decoration: const InputDecoration(labelText: 'Describe lo sucedido', border: OutlineInputBorder()),
          validator: (value) => value == null || value.trim().isEmpty ? 'Describe el incidente' : null),
        const SizedBox(height: 12), OutlinedButton.icon(onPressed: locate, icon: const Icon(Icons.my_location), label: const Text('Usar mi GPS')),
        if (accuracy != null) Text('Precisión estimada: ${accuracy!.toStringAsFixed(0)} m · ${formatDate(capturedAt?.toIso8601String())}'),
        const SizedBox(height: 8), const Text('Toca el mapa para corregir el marcador o escribe las coordenadas.',
          style: TextStyle(fontSize: 12)), const SizedBox(height: 8),
        SizedBox(height: 280, child: ClipRRect(borderRadius: BorderRadius.circular(12), child: FlutterMap(mapController: map,
          options: MapOptions(initialCenter: const LatLng(-13.16, -74.22), initialZoom: 13,
            onTap: (_, location) => choosePoint(location)), children: [
            TileLayer(urlTemplate: AppConfig.tileUrl, userAgentPackageName: 'org.incidencias.mobile'),
            if (point != null) MarkerLayer(markers: [Marker(point: point!, width: 42, height: 42,
              child: const Icon(Icons.location_on, color: Colors.red, size: 42))]),
            const RichAttributionWidget(attributions: [TextSourceAttribution('© OpenStreetMap contributors')]),
          ]))),
        Row(children: [Expanded(child: TextField(key: const Key('latitude'), controller: latitude, keyboardType: TextInputType.number,
          decoration: const InputDecoration(labelText: 'Latitud'))), const SizedBox(width: 12),
          Expanded(child: TextField(key: const Key('longitude'), controller: longitude, keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Longitud'))),
          IconButton(onPressed: manualPoint, icon: const Icon(Icons.check_circle_outline), tooltip: 'Fijar coordenadas')]),
        if (widget.api.signedIn) OutlinedButton.icon(onPressed: () => showModalBottomSheet<void>(context: context,
          builder: (context) => SafeArea(child: Column(mainAxisSize: MainAxisSize.min, children: [
            ListTile(leading: const Icon(Icons.photo_library_outlined), title: const Text('Elegir de galería'),
              onTap: () { Navigator.pop(context); pickPhoto(ImageSource.gallery); }),
            ListTile(leading: const Icon(Icons.camera_alt_outlined), title: const Text('Tomar foto'),
              onTap: () { Navigator.pop(context); pickPhoto(ImageSource.camera); }),
          ]))), icon: const Icon(Icons.add_a_photo_outlined), label: Text(photoPath == null ? 'Adjuntar foto opcional' : 'Cambiar foto')),
        if (!widget.api.signedIn) const Text('Para adjuntar fotos, inicia sesión. Puedes reportar como invitado.', style: TextStyle(fontSize: 12)),
        const SizedBox(height: 18), FilledButton.icon(onPressed: busy ? null : submit,
          icon: const Icon(Icons.send_outlined), label: Text(busy ? 'Enviando…' : 'Enviar reporte')),
      ])),
    ]))]);
}
