import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:incidencias_mobile/core/api.dart';
import 'package:incidencias_mobile/core/pending.dart';
import 'package:incidencias_mobile/screens/report.dart';
import 'report_test.dart' show ReportApi, ReportPending;

class TriageApi extends ReportApi {
  bool failSend = false;
  bool failSubtypes = false;
  Completer<List<Map<String, dynamic>>>? delayedSubtypes;
  @override
  Future<List<Map<String, dynamic>>> list(
    String path, {
    bool auth = false,
  }) async {
    if (path.endsWith('/subcategories')) {
      if (failSubtypes) throw Exception('offline');
      if (path.contains('/2/') && delayedSubtypes != null) {
        return delayedSubtypes!.future;
      }
      final category = path.contains('/2/') ? 2 : 3;
      return [
        {
          'id': category * 10,
          'categoryId': category,
          'name': category == 2 ? 'Lesión' : 'Colisión',
          'active': true,
        },
      ];
    }
    return [
      {'id': 1, 'code': 'fire', 'name': 'Incendio'},
      {'id': 2, 'code': 'medical_emergency', 'name': 'Emergencia médica'},
      {'id': 3, 'code': 'traffic_accident', 'name': 'Accidente de tránsito'},
    ];
  }

  @override
  Future<Map<String, dynamic>> submitReport(
    Map<String, dynamic> body,
    String clientRequestId,
  ) async {
    if (failSend) throw ApiException(422, 'Corrige el reporte');
    return super.submitReport(body, clientRequestId);
  }
}

Future<void> chooseCategory(WidgetTester tester, String label) async {
  final selector = find.byKey(const Key('reportCategory'));
  await tester.ensureVisible(selector);
  await tester.tap(selector);
  await tester.pumpAndSettle();
  await tester.tap(find.text(label).last);
  await tester.pumpAndSettle();
}

Future<void> openTriage(WidgetTester tester, TriageApi api) async {
  tester.view.physicalSize = const Size(1000, 2400);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: ReportScreen(
          api: api,
          submissions: SubmissionService(api, ReportPending()),
          locationReader: () async =>
              LocationFix(-13.1, -74.1, 5, DateTime.utc(2026)),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
  expect(find.byKey(const Key('samuTriage')), findsNothing);
  await chooseCategory(tester, 'Emergencia médica');
}

void main() {
  testWidgets('triaje condicional limpia valores y descarta subtipos tardíos', (
    tester,
  ) async {
    final api = TriageApi();
    await openTriage(tester, api);
    expect(
      tester
          .widget<ChoiceChip>(find.byKey(const Key('isConscious-null')))
          .selected,
      isTrue,
    );
    await tester.tap(find.byKey(const Key('isConscious-false')));
    api.delayedSubtypes = Completer();
    await chooseCategory(tester, 'Incendio');
    expect(find.byKey(const Key('samuTriage')), findsNothing);
    // Pump without waiting for the loading indicator on this category.
    await tester.tap(find.byKey(const Key('reportCategory')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Emergencia médica').last);
    await tester.pump();
    await tester.tap(find.byKey(const Key('reportCategory')));
    await tester.pump(const Duration(seconds: 1));
    await tester.tap(find.text('Accidente de tránsito').last);
    await tester.pumpAndSettle();
    api.delayedSubtypes!.complete([
      {'id': 20, 'categoryId': 2, 'name': 'Lesión', 'active': true},
    ]);
    await tester.pumpAndSettle();
    expect(
      tester
          .widget<ChoiceChip>(find.byKey(const Key('isConscious-null')))
          .selected,
      isTrue,
    );
    await tester.tap(find.byKey(const ValueKey('subcategory-3')));
    await tester.pumpAndSettle();
    expect(find.text('Colisión'), findsOneWidget);
    expect(find.text('Lesión'), findsNothing);
    await tester.pumpWidget(const SizedBox.shrink());
    api.dispose();
  });

  testWidgets(
    'cantidad exacta valida mínimo y envío conserva false, true y null',
    (tester) async {
      final api = TriageApi();
      await openTriage(tester, api);
      await tester.tap(find.byKey(const ValueKey('affectedChoice-2')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('3 o más').last);
      await tester.pumpAndSettle();
      final form = tester.state<FormState>(find.byType(Form));
      for (final invalid in ['0', '1', '2', '-1', '3.5', 'abc']) {
        await tester.enterText(find.byKey(const Key('affectedCount')), invalid);
        form.validate();
        await tester.pump();
        expect(find.text('Escribe un entero de 3 o más'), findsOneWidget);
      }
      await tester.enterText(find.byKey(const Key('affectedCount')), '4');
      await tester.tap(find.byKey(const Key('isConscious-false')));
      await tester.tap(find.byKey(const Key('isBreathing-true')));
      await tester.tap(find.byKey(const ValueKey('subcategory-2')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Lesión').last);
      await tester.pumpAndSettle();
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Describe lo sucedido'),
        'Persona principal junto al vehículo',
      );
      await tester.ensureVisible(find.text('Usar mi ubicación'));
      await tester.tap(find.text('Usar mi ubicación'));
      await tester.pumpAndSettle();
      api.failSend = true;
      await tester.ensureVisible(find.text('Enviar reporte'));
      await tester.tap(find.text('Enviar reporte'));
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<ChoiceChip>(find.byKey(const Key('isConscious-false')))
            .selected,
        isTrue,
      );
      api.failSend = false;
      await tester.ensureVisible(find.text('Enviar reporte'));
      await tester.tap(find.text('Enviar reporte'));
      await tester.pumpAndSettle();
      expect(api.lastBody, containsPair('affectedPeople', 4));
      expect(api.lastBody, containsPair('subcategoryId', 20));
      expect(api.lastBody, containsPair('isConscious', false));
      expect(api.lastBody, containsPair('isBreathing', true));
      expect(api.lastBody, containsPair('hasBleeding', null));
      expect(find.byKey(const Key('samuTriage')), findsNothing);
      await tester.pumpWidget(const SizedBox.shrink());
      api.dispose();
    },
  );

  testWidgets(
    'cero difiere de desconocido y el bloque cabe con texto ampliado',
    (tester) async {
      final api = TriageApi()..failSubtypes = true;
      await openTriage(tester, api);
      expect(find.text('No se cargaron subtipos. Reintentar'), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('affectedChoice-2')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('0').last);
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<DropdownButtonFormField<int>>(
              find.byKey(const ValueKey('affectedChoice-2')),
            )
            .initialValue,
        0,
      );
      tester.view.physicalSize = const Size(360, 800);
      await tester.pumpWidget(
        MaterialApp(
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(
              context,
            ).copyWith(textScaler: const TextScaler.linear(1.6)),
            child: child!,
          ),
          home: Scaffold(
            body: ReportScreen(
              api: api,
              submissions: SubmissionService(api, ReportPending()),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await chooseCategory(tester, 'Accidente de tránsito');
      await tester.ensureVisible(find.byKey(const Key('hasBleeding-null')));
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
      api.dispose();
    },
  );
}
