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
  const LocationFix(
    this.latitude,
    this.longitude,
    this.accuracyMeters,
    this.capturedAt,
  );
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
  if (permission == LocationPermission.denied) {
    permission = await Geolocator.requestPermission();
  }
  if (permission == LocationPermission.denied ||
      permission == LocationPermission.deniedForever) {
    throw Exception(
      'Permiso de ubicación denegado. Puedes marcar el punto en el mapa.',
    );
  }
  final position = await Geolocator.getCurrentPosition(
    locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
  );
  return LocationFix(
    position.latitude,
    position.longitude,
    position.accuracy,
    position.timestamp,
  );
}

class ReportScreen extends StatefulWidget {
  const ReportScreen({
    super.key,
    required this.api,
    required this.submissions,
    this.locationReader = readDeviceLocation,
  });
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
  final contactPhone = TextEditingController();
  final locationReference = TextEditingController();
  late Future<List<Map<String, dynamic>>> categories = widget.api.list(
    '/catalog/categories',
  );
  int? categoryId;
  String? categoryCode;
  int? subcategoryId;
  int affectedChoice = -1;
  bool? isConscious;
  bool? isBreathing;
  bool? hasBleeding;
  final affectedCount = TextEditingController();
  Future<List<Map<String, dynamic>>>? subcategories;
  bool get hasTriage =>
      categoryCode == 'medical_emergency' || categoryCode == 'traffic_accident';
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
  bool contactEdited = false;
  String? contactIdentity;
  @override
  void initState() {
    super.initState();
    widget.api.addListener(syncContact);
    syncContact();
  }

  void syncContact() {
    final identity = widget.api.signedIn
        ? (widget.api.user?['id']?.toString())
        : null;
    if (identity != contactIdentity) {
      contactIdentity = identity;
      contactEdited = false;
      contactPhone.clear();
    }
    if (!contactEdited) {
      contactPhone.text = identity == null
          ? ''
          : widget.api.user?['phone']?.toString() ?? '';
    }
  }

  @override
  void dispose() {
    widget.api.removeListener(syncContact);
    description.dispose();
    contactPhone.dispose();
    locationReference.dispose();
    affectedCount.dispose();
    map.dispose();
    super.dispose();
  }

  void clearTriage() {
    subcategoryId = null;
    affectedChoice = -1;
    affectedCount.clear();
    isConscious = null;
    isBreathing = null;
    hasBleeding = null;
    subcategories = null;
  }

  void loadSubcategories() {
    subcategories = widget.api.list(
      '/catalog/categories/$categoryId/subcategories',
    );
    // El builder se suscribe en el siguiente frame, incluso si la consulta falla inmediatamente.
    subcategories!.ignore();
  }

  Widget observation(
    String field,
    String question,
    bool? value,
    ValueChanged<bool?> change,
  ) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(question, style: Theme.of(context).textTheme.titleSmall),
      Wrap(
        spacing: 8,
        children: [
          for (final option in <bool?>[true, false, null])
            ChoiceChip(
              key: Key('$field-$option'),
              label: Text(
                option == null
                    ? 'No sé'
                    : option
                    ? 'Sí'
                    : 'No',
              ),
              selected: value == option,
              onSelected: busy ? null : (_) => setState(() => change(option)),
            ),
        ],
      ),
      const SizedBox(height: 12),
    ],
  );

  Widget triageBlock() => Card(
    key: const Key('samuTriage'),
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Cuestionario rápido para SAMU',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const Text('Opcional. Responde lo que sepas.'),
          const SizedBox(height: 16),
          FutureBuilder<List<Map<String, dynamic>>>(
            key: ValueKey('subcategories-$categoryId'),
            future: subcategories,
            builder: (context, snapshot) {
              if (snapshot.hasError) {
                return TextButton(
                  onPressed: () => setState(loadSubcategories),
                  child: const Text('No se cargaron subtipos. Reintentar'),
                );
              }
              if (!snapshot.hasData) return const LinearProgressIndicator();
              final options = snapshot.data!
                  .where(
                    (item) =>
                        item['categoryId'] == categoryId &&
                        item['active'] != false,
                  )
                  .toList();
              if (options.isEmpty) {
                return const Text(
                  'Sin subtipos disponibles. Puedes continuar.',
                );
              }
              return DropdownButtonFormField<int>(
                key: ValueKey('subcategory-$categoryId'),
                initialValue: subcategoryId,
                isExpanded: true,
                decoration: const InputDecoration(
                  labelText: 'Subtipo (opcional)',
                ),
                items: [
                  const DropdownMenuItem<int>(
                    value: null,
                    child: Text('No sé'),
                  ),
                  ...options.map(
                    (item) => DropdownMenuItem(
                      value: item['id'] as int,
                      child: Text(item['name'] as String),
                    ),
                  ),
                ],
                onChanged: busy
                    ? null
                    : (value) => setState(() => subcategoryId = value),
              );
            },
          ),
          const SizedBox(height: 16),
          DropdownButtonFormField<int>(
            key: ValueKey('affectedChoice-$categoryId'),
            initialValue: affectedChoice,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Personas afectadas'),
            items: [
              for (final count in [-1, 0, 1, 2, 3])
                DropdownMenuItem(
                  value: count,
                  child: Text(
                    count == -1
                        ? 'No sé'
                        : count == 3
                        ? '3 o más'
                        : '$count',
                  ),
                ),
            ],
            onChanged: busy
                ? null
                : (value) => setState(() {
                    affectedChoice = value ?? -1;
                    affectedCount.clear();
                  }),
          ),
          if (affectedChoice == 3)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: TextFormField(
                key: const Key('affectedCount'),
                controller: affectedCount,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Cantidad exacta de afectados',
                ),
                validator: (value) {
                  final count = int.tryParse(value?.trim() ?? '');
                  if (count == null || count < 3 || count > 9007199254740991) {
                    return 'Escribe un entero de 3 o más';
                  }
                  return null;
                },
              ),
            ),
          const SizedBox(height: 16),
          const Text(
            'Sobre la persona principal. Si hay varias, indica en la descripción a quién te refieres.',
          ),
          const SizedBox(height: 12),
          observation(
            'isConscious',
            '¿Está consciente?',
            isConscious,
            (value) => isConscious = value,
          ),
          observation(
            'isBreathing',
            '¿Está respirando?',
            isBreathing,
            (value) => isBreathing = value,
          ),
          observation(
            'hasBleeding',
            '¿Tiene sangrado?',
            hasBleeding,
            (value) => hasBleeding = value,
          ),
        ],
      ),
    ),
  );

  void choosePoint(LatLng selected, {double? accuracyMeters, DateTime? at}) {
    if (selected.latitude < -90 ||
        selected.latitude > 90 ||
        selected.longitude < -180 ||
        selected.longitude > 180) {
      return;
    }
    setState(() {
      point = selected;
      accuracy = accuracyMeters;
      capturedAt = at;
    });
    map.move(selected, 15);
  }

  Future<void> locate() async {
    try {
      final position = await widget.locationReader();
      if (!mounted) return;
      choosePoint(
        LatLng(position.latitude, position.longitude),
        accuracyMeters: position.accuracyMeters,
        at: position.capturedAt,
      );
      setState(() => error = null);
    } catch (issue) {
      if (mounted) setState(() => error = issue.toString());
    }
  }

  Future<void> pickPhoto(ImageSource source) async {
    try {
      final image = await ImagePicker().pickImage(
        source: source,
        imageQuality: 85,
      );
      if (image == null) return;
      final extension = image.path.split('.').last.toLowerCase();
      final stored = File(
        '${(await getApplicationSupportDirectory()).path}/${const Uuid().v4()}.$extension',
      );
      await File(image.path).copy(stored.path);
      if (mounted) {
        setState(() {
          photoPath = stored.path;
          photoError = null;
        });
      }
    } catch (issue) {
      if (mounted) {
        setState(() => error = 'No se pudo preparar la foto: $issue');
      }
    }
  }

  Future<void> submit() async {
    if (!form.currentState!.validate()) {
      return;
    }
    if (point == null || categoryId == null) {
      setState(() => error = 'Selecciona categoría y ubicación.');
      return;
    }
    setState(() {
      busy = true;
      error = null;
      pending = false;
      receipt = null;
      photoError = null;
    });
    requestId ??= const Uuid().v4();
    final report = PendingReport(
      clientRequestId: requestId!,
      photoPath: photoPath,
      body: {
        'categoryId': categoryId,
        'description': description.text.trim(),
        if (hasTriage) ...{
          'subcategoryId': subcategoryId,
          'affectedPeople': affectedChoice == -1
              ? null
              : affectedChoice == 3
              ? int.parse(affectedCount.text.trim())
              : affectedChoice,
          'isConscious': isConscious,
          'isBreathing': isBreathing,
          'hasBleeding': hasBleeding,
        },
        if (contactPhone.text.trim().isNotEmpty)
          'callerContact': contactPhone.text.trim(),
        'location': {
          'latitude': point!.latitude,
          'longitude': point!.longitude,
          if (accuracy != null) 'accuracyMeters': accuracy,
          if (capturedAt != null)
            'capturedAt': capturedAt!.toUtc().toIso8601String(),
          if (locationReference.text.trim().isNotEmpty)
            'reference': locationReference.text.trim(),
        },
      },
    );
    try {
      final result = await widget.submissions.submit(report);
      if (!mounted) return;
      setState(() {
        receipt = result.receipt;
        pending = result.pending;
        photoError = result.photoError;
        busy = false;
        requestId = null;
        if (result.pending || result.receipt != null) {
          form.currentState?.reset();
          description.clear();
          contactPhone.clear();
          contactEdited = false;
          syncContact();
          categoryId = null;
          categoryCode = null;
          clearTriage();
          point = null;
          locationReference.clear();
          accuracy = null;
          capturedAt = null;
        }
        if (result.photoError == null) photoPath = null;
      });
    } catch (issue) {
      if (mounted) {
        setState(() {
          error = issue.toString();
          busy = false;
        });
      }
    }
  }

  Future<void> retryPhoto() async {
    if (receipt == null || photoPath == null) return;
    try {
      final queued = (await widget.submissions.repository.all())
          .where((item) => item.receipt?['id'] == receipt!['id'])
          .toList();
      if (queued.isEmpty) return;
      final result = await widget.submissions.submit(queued.first);
      if (mounted) {
        setState(() {
          photoError = result.photoError;
          if (result.photoError == null) photoPath = null;
        });
      }
    } catch (issue) {
      if (mounted) setState(() => photoError = issue.toString());
    }
  }

  @override
  Widget build(BuildContext context) => ListView(
    children: [
      ScreenPadding(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Nuevo reporte',
              style: Theme.of(
                context,
              ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            const Text(
              'Cuéntanos qué ocurre y confirma el punto exacto antes de enviar.',
            ),
            if (pending)
              const MessageCard(
                icon: Icons.wifi_off,
                message:
                    'Pendiente de envío. Aún no fue recibido por la institución. Se reintentará con el mismo identificador.',
              ),
            if (receipt != null)
              Card(
                color: const Color(0xFFE3F5EB),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Reporte confirmado',
                        style: TextStyle(fontWeight: FontWeight.bold),
                      ),
                      Text('Referencia: ${receipt!['reference']}'),
                      Text('Estado: ${receipt!['status']}'),
                    ],
                  ),
                ),
              ),
            if (photoError != null)
              Column(
                children: [
                  MessageCard(
                    icon: Icons.photo_outlined,
                    message:
                        'Reporte confirmado; la foto aún no se envió. $photoError',
                  ),
                  TextButton(
                    onPressed: retryPhoto,
                    child: const Text('Reintentar foto'),
                  ),
                ],
              ),
            if (error != null)
              MessageCard(icon: Icons.error_outline, message: error!),
            Form(
              key: form,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: 18),
                  FutureBuilder<List<Map<String, dynamic>>>(
                    future: categories,
                    builder: (context, snapshot) {
                      if (snapshot.hasError) {
                        return TextButton(
                          onPressed: () => setState(
                            () => categories = widget.api.list(
                              '/catalog/categories',
                            ),
                          ),
                          child: const Text(
                            'No se cargaron categorías. Reintentar',
                          ),
                        );
                      }
                      return DropdownButtonFormField<int>(
                        key: const Key('reportCategory'),
                        initialValue: categoryId,
                        isExpanded: true,
                        decoration: const InputDecoration(
                          labelText: 'Categoría',
                        ),
                        items: (snapshot.data ?? [])
                            .map(
                              (item) => DropdownMenuItem(
                                value: item['id'] as int,
                                child: Text(item['name'] as String),
                              ),
                            )
                            .toList(),
                        onChanged: busy
                            ? null
                            : (value) => setState(() {
                                if (value == categoryId) return;
                                categoryId = value;
                                categoryCode =
                                    snapshot.data?.firstWhere(
                                          (item) => item['id'] == value,
                                        )['code']
                                        as String?;
                                clearTriage();
                                if (hasTriage) loadSubcategories();
                              }),
                        validator: (value) =>
                            value == null ? 'Elige una categoría' : null,
                      );
                    },
                  ),
                  const SizedBox(height: 12),
                  if (hasTriage) triageBlock(),
                  TextFormField(
                    controller: description,
                    maxLines: 3,
                    maxLength: 2000,
                    decoration: const InputDecoration(
                      labelText: 'Describe lo sucedido',
                      border: OutlineInputBorder(),
                    ),
                    validator: (value) => value == null || value.trim().isEmpty
                        ? 'Describe el incidente'
                        : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    key: const Key('contactPhone'),
                    controller: contactPhone,
                    onChanged: (_) => contactEdited = true,
                    keyboardType: TextInputType.phone,
                    autofillHints: const [AutofillHints.telephoneNumber],
                    maxLength: 20,
                    decoration: const InputDecoration(
                      labelText: 'Teléfono de contacto (opcional)',
                      hintText: 'Para que la central pueda llamarte',
                      helperText: 'Solo lo verá el personal autorizado.',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.phone_outlined),
                    ),
                    validator: (value) {
                      final phone = value?.trim() ?? '';
                      if (phone.isEmpty) return null;
                      final digits = phone.replaceAll(RegExp(r'\D'), '');
                      if (!RegExp(r'^\+?[0-9 ()-]{7,20}$').hasMatch(phone) ||
                          digits.length < 7 ||
                          digits.length > 15) {
                        return 'Escribe un teléfono válido o deja el campo vacío';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    key: const Key('locationReference'),
                    controller: locationReference,
                    maxLength: 500,
                    decoration: const InputDecoration(
                      labelText: 'Referencia del lugar (opcional)',
                      hintText: 'Calle, avenida, mercado o punto cercano',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.signpost_outlined),
                    ),
                    textCapitalization: TextCapitalization.sentences,
                    onChanged: (_) => setState(() {}),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: locate,
                          icon: const Icon(Icons.my_location),
                          label: const Text('Usar mi ubicación'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'También puedes marcar directamente el lugar que te indicaron en el mapa.',
                          style: TextStyle(fontSize: 11, color: Colors.black54),
                        ),
                      ),
                    ],
                  ),
                  if (point == null)
                    const Padding(
                      padding: EdgeInsets.only(top: 8),
                      child: Text(
                        'Toca el mapa para elegir dónde ocurrió el hecho.',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF0E7774),
                        ),
                      ),
                    )
                  else
                    Card(
                      margin: const EdgeInsets.only(top: 8),
                      color: const Color(0xFFE8F5F2),
                      child: ListTile(
                        dense: true,
                        leading: const Icon(
                          Icons.location_on,
                          color: Color(0xFF0E7774),
                        ),
                        title: Text(
                          locationReference.text.trim().isEmpty
                              ? 'Punto seleccionado en el mapa'
                              : locationReference.text.trim(),
                        ),
                        subtitle: Text(
                          accuracy == null
                              ? 'Ubicación lista para enviar'
                              : 'Precisión estimada: ${accuracy!.toStringAsFixed(0)} m · ${formatDate(capturedAt?.toIso8601String())}',
                        ),
                      ),
                    ),
                  const SizedBox(height: 8),
                  SizedBox(
                    height: 280,
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: FlutterMap(
                        mapController: map,
                        options: MapOptions(
                          initialCenter: const LatLng(-13.16, -74.22),
                          initialZoom: 13,
                          onTap: (_, location) => choosePoint(location),
                        ),
                        children: [
                          TileLayer(
                            urlTemplate: AppConfig.tileUrl,
                            userAgentPackageName: 'org.incidencias.mobile',
                          ),
                          if (point != null)
                            MarkerLayer(
                              markers: [
                                Marker(
                                  point: point!,
                                  width: 42,
                                  height: 42,
                                  child: const Icon(
                                    Icons.location_on,
                                    color: Colors.red,
                                    size: 42,
                                  ),
                                ),
                              ],
                            ),
                          const RichAttributionWidget(
                            attributions: [
                              TextSourceAttribution(
                                '© OpenStreetMap contributors',
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                  OutlinedButton.icon(
                    onPressed: () => showModalBottomSheet<void>(
                      context: context,
                      builder: (context) => SafeArea(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            ListTile(
                              leading: const Icon(Icons.photo_library_outlined),
                              title: const Text('Elegir de galería'),
                              onTap: () {
                                Navigator.pop(context);
                                pickPhoto(ImageSource.gallery);
                              },
                            ),
                            ListTile(
                              leading: const Icon(Icons.camera_alt_outlined),
                              title: const Text('Tomar foto'),
                              onTap: () {
                                Navigator.pop(context);
                                pickPhoto(ImageSource.camera);
                              },
                            ),
                          ],
                        ),
                      ),
                    ),
                    icon: const Icon(Icons.add_a_photo_outlined),
                    label: Text(
                      photoPath == null
                          ? 'Adjuntar foto opcional'
                          : 'Cambiar foto',
                    ),
                  ),
                  const Text(
                    'La foto es opcional. Puedes tomarla y enviar tu reporte sin iniciar sesión.',
                    style: TextStyle(fontSize: 12),
                  ),
                  const SizedBox(height: 18),
                  FilledButton.icon(
                    onPressed: busy ? null : submit,
                    icon: const Icon(Icons.send_outlined),
                    label: Text(busy ? 'Enviando…' : 'Enviar reporte'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    ],
  );
}
