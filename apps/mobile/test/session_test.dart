import 'dart:async';
import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:incidencias_mobile/core/api.dart';

http.Response tokens(String suffix) => http.Response(
  jsonEncode({
    'accessToken': 'access-$suffix',
    'refreshToken': 'refresh-$suffix',
  }),
  200,
);
http.Response profile(String name, {String? phone}) => http.Response(
  jsonEncode({
    'id': 'citizen',
    'name': name,
    'email': 'test@example.invalid',
    'phone': phone,
  }),
  200,
);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));

  test(
    'ingreso y edición recuperan perfil sin enviar correo editable',
    () async {
      final api = ApiClient(
        baseUrl: 'https://example.invalid/api/v1',
        client: MockClient((request) async {
          if (request.url.path.endsWith('/login')) return tokens('login');
          if (request.method == 'PATCH') {
            expect(jsonDecode(request.body), {
              'name': 'Editado',
              'phone': '999111222',
            });
            return profile('Editado', phone: '999111222');
          }
          return profile('Inicial');
        }),
      );
      await api.login('test@example.invalid', 'test-password');
      expect(api.user?['name'], 'Inicial');
      await api.updateProfile('Editado', '999111222');
      expect(api.user?['phone'], '999111222');
      api.dispose();
    },
  );

  test(
    'restauración válida carga perfil y fallo de red conserva token para reintentar',
    () async {
      FlutterSecureStorage.setMockInitialValues({'refreshToken': 'saved'});
      var failRefresh = true;
      var failProfile = true;
      var renewals = 0;
      final api = ApiClient(
        baseUrl: 'https://example.invalid/api/v1',
        client: MockClient((request) async {
          if (request.url.path.endsWith('/refresh')) {
            renewals++;
            if (failRefresh) throw http.ClientException('offline');
            return tokens('restored');
          }
          if (failProfile) return http.Response('{}', 503);
          return profile('Restaurado', phone: '999111222');
        }),
      );
      await api.restore();
      expect(api.sessionError, isNotNull);
      expect(
        await const FlutterSecureStorage().read(key: 'refreshToken'),
        'saved',
      );
      failRefresh = false;
      await api.restore();
      expect(
        await const FlutterSecureStorage().read(key: 'refreshToken'),
        'refresh-restored',
      );
      failProfile = false;
      await api.restore();
      expect(renewals, 2);
      expect(api.user?['name'], 'Restaurado');
      expect(api.sessionError, isNull);
      expect(api.restoring, isFalse);
      api.dispose();
    },
  );

  test('sin token no consulta API y sesión rechazada se elimina', () async {
    var calls = 0;
    final api = ApiClient(
      baseUrl: 'https://example.invalid/api/v1',
      client: MockClient((request) async {
        calls++;
        return http.Response('{}', 401);
      }),
    );
    await api.restore();
    expect(calls, 0);
    FlutterSecureStorage.setMockInitialValues({'refreshToken': 'invalid'});
    await api.restore();
    expect(api.signedIn, isFalse);
    expect(
      await const FlutterSecureStorage().read(key: 'refreshToken'),
      isNull,
    );
    expect(api.restoring, isFalse);
    api.dispose();
  });

  test('dos solicitudes comparten una renovación', () async {
    final renewal = Completer<http.Response>();
    var renewals = 0;
    final api = ApiClient(
      baseUrl: 'https://example.invalid/api/v1',
      client: MockClient((request) async {
        if (request.url.path.endsWith('/login')) return tokens('old');
        if (request.url.path.endsWith('/me')) return profile('Test');
        if (request.url.path.endsWith('/refresh')) {
          renewals++;
          return renewal.future;
        }
        return request.headers['Authorization'] == 'Bearer access-old'
            ? http.Response('{}', 401)
            : http.Response('{}', 200);
      }),
    );
    await api.login('test@example.invalid', 'test-password');
    final requests = Future.wait([
      api.request('GET', '/one'),
      api.request('GET', '/two'),
    ]);
    await Future<void>.delayed(Duration.zero);
    expect(renewals, 1);
    renewal.complete(tokens('new'));
    await requests;
    api.dispose();
  });

  for (final switchAccount in [false, true]) {
    test(
      'respuesta tardía no recupera sesión anterior, cambio de cuenta $switchAccount',
      () async {
        FlutterSecureStorage.setMockInitialValues({'refreshToken': 'old'});
        final started = Completer<void>();
        final renewal = Completer<http.Response>();
        final api = ApiClient(
          baseUrl: 'https://example.invalid/api/v1',
          client: MockClient((request) async {
            if (request.url.path.endsWith('/refresh')) {
              started.complete();
              return renewal.future;
            }
            if (request.url.path.endsWith('/login')) return tokens('other');
            if (request.url.path.endsWith('/me')) return profile('Otra cuenta');
            return http.Response('', 204);
          }),
        );
        final restoring = api.restore();
        await started.future;
        if (switchAccount) {
          await api.login('other@example.invalid', 'test-password');
        } else {
          await api.logout();
        }
        renewal.complete(tokens('stale'));
        await restoring;
        expect(api.signedIn, switchAccount);
        expect(
          await const FlutterSecureStorage().read(key: 'refreshToken'),
          switchAccount ? 'refresh-other' : isNull,
        );
        expect(api.user?['name'], switchAccount ? 'Otra cuenta' : isNull);
        api.dispose();
      },
    );
  }
}
