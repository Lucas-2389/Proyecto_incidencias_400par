import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:incidencias_mobile/core/api.dart';
import 'package:incidencias_mobile/core/pending.dart';

class MemoryPending implements PendingRepository {
  final reports = <String, PendingReport>{};
  @override
  Future<List<PendingReport>> all() async => reports.values.toList();
  @override
  Future<void> save(PendingReport report) async { reports[report.clientRequestId] = report; }
  @override
  Future<void> remove(String clientRequestId) async { reports.remove(clientRequestId); }
}

class FakeApi extends ApiClient {
  FakeApi() : super(baseUrl: 'http://example.invalid/api/v1');
  bool offline = false;
  bool failPhoto = false;
  final keys = <String>[];
  @override
  bool get signedIn => true;
  @override
  Future<Map<String, dynamic>> submitReport(Map<String, dynamic> body, String clientRequestId) async {
    keys.add(clientRequestId);
    if (offline) throw http.ClientException('offline');
    return {'id': 'incident-1', 'reference': 'AYA-1', 'status': 'reported'};
  }
  @override
  Future<void> uploadPhoto(String incidentId, String filePath) async {
    if (failPhoto) throw ApiException(503, 'Foto pendiente');
  }
}

void main() {
  test('guarda el reporte sin red y reintenta con el mismo identificador', () async {
    final api = FakeApi()..offline = true;
    final pending = MemoryPending();
    final service = SubmissionService(api, pending);
    final report = PendingReport(clientRequestId: 'stable-uuid', body: {
      'categoryId': 1, 'description': 'Prueba', 'location': {'latitude': -13.16, 'longitude': -74.22},
    });
    expect((await service.submit(report)).pending, isTrue);
    expect((await pending.all()).single.clientRequestId, 'stable-uuid');
    api.offline = false;
    final result = (await service.retryPending()).single;
    expect(result.receipt?['reference'], 'AYA-1');
    expect(api.keys, ['stable-uuid', 'stable-uuid']);
    expect(await pending.all(), isEmpty);
    api.dispose();
  });

  test('un error de foto conserva la referencia confirmada', () async {
    final api = FakeApi()..failPhoto = true;
    final pending = MemoryPending();
    final service = SubmissionService(api, pending);
    final photo = await File('${Directory.systemTemp.path}/mobile-photo-test.jpg').writeAsBytes([1, 2]);
    final result = await service.submit(PendingReport(
      clientRequestId: 'photo-uuid', body: {'categoryId': 1}, photoPath: photo.path,
    ));
    expect(result.receipt?['reference'], 'AYA-1');
    expect(result.photoError, isNotNull);
    expect((await pending.all()).single.receipt?['reference'], 'AYA-1');
    api.failPhoto = false;
    final retry = (await service.retryPending()).single;
    expect(retry.receipt?['reference'], 'AYA-1');
    expect(api.keys, ['photo-uuid']);
    expect(await pending.all(), isEmpty);
    expect(await photo.exists(), isFalse);
    api.dispose();
  });
}
