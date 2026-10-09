import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import 'api.dart';

class PendingReport {
  PendingReport({required this.clientRequestId, required this.body, this.photoPath, this.receipt});
  final String clientRequestId;
  final Map<String, dynamic> body;
  final String? photoPath;
  final Map<String, dynamic>? receipt;
  Map<String, dynamic> toJson() => {'clientRequestId': clientRequestId, 'body': body, 'photoPath': photoPath, 'receipt': receipt};
  factory PendingReport.fromJson(Map<String, dynamic> json) => PendingReport(
    clientRequestId: json['clientRequestId'] as String,
    body: Map<String, dynamic>.from(json['body'] as Map), photoPath: json['photoPath'] as String?,
    receipt: json['receipt'] is Map ? Map<String, dynamic>.from(json['receipt'] as Map) : null,
  );
}

abstract class PendingRepository {
  Future<List<PendingReport>> all();
  Future<void> save(PendingReport report);
  Future<void> remove(String clientRequestId);
}

class SharedPendingRepository implements PendingRepository {
  SharedPendingRepository(this.preferences);
  final SharedPreferences preferences;
  static const key = 'pendingReportsV1';
  @override
  Future<List<PendingReport>> all() async => (preferences.getStringList(key) ?? [])
      .map((item) => PendingReport.fromJson(Map<String, dynamic>.from(jsonDecode(item) as Map))).toList();
  @override
  Future<void> save(PendingReport report) async {
    final reports = await all();
    reports.removeWhere((item) => item.clientRequestId == report.clientRequestId);
    reports.add(report);
    await preferences.setStringList(key, reports.map((item) => jsonEncode(item.toJson())).toList());
  }
  @override
  Future<void> remove(String clientRequestId) async {
    final reports = await all();
    reports.removeWhere((item) => item.clientRequestId == clientRequestId);
    await preferences.setStringList(key, reports.map((item) => jsonEncode(item.toJson())).toList());
  }
}

class SubmissionResult {
  SubmissionResult({this.receipt, this.pending = false, this.photoError});
  final Map<String, dynamic>? receipt;
  final bool pending;
  final String? photoError;
}

class SubmissionService {
  SubmissionService(this.api, this.repository);
  final ApiClient api;
  final PendingRepository repository;

  Future<SubmissionResult> submit(PendingReport report) async {
    Map<String, dynamic> receipt;
    if (report.receipt != null) {
      receipt = report.receipt!;
    } else {
      try {
        receipt = await api.submitReport(report.body, report.clientRequestId);
      } on SocketException {
        await repository.save(report);
        return SubmissionResult(pending: true);
      } on HttpException {
        await repository.save(report);
        return SubmissionResult(pending: true);
      } on http.ClientException {
        await repository.save(report);
        return SubmissionResult(pending: true);
      }
    }
    if (report.photoPath != null) {
      final confirmed = PendingReport(clientRequestId: report.clientRequestId,
        body: report.body, photoPath: report.photoPath, receipt: receipt);
      await repository.save(confirmed);
      try {
        await api.uploadPhoto(receipt['id'] as String, report.photoPath!);
        await File(report.photoPath!).delete().catchError((_) => File(report.photoPath!));
      } catch (error) {
        return SubmissionResult(receipt: receipt, photoError: error.toString());
      }
    }
    await repository.remove(report.clientRequestId);
    return SubmissionResult(receipt: receipt);
  }

  Future<List<SubmissionResult>> retryPending() async {
    final results = <SubmissionResult>[];
    for (final report in await repository.all()) {
      final result = await submit(report);
      results.add(result);
      if (result.pending) break;
    }
    return results;
  }
}
