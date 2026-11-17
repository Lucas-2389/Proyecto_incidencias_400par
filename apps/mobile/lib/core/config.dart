class AppConfig {
  static const environment = String.fromEnvironment('APP_ENV', defaultValue: 'production');
  static const productionApiUrl = 'https://gestion-incidencias-200e.onrender.com/api/v1';
  static const _override = String.fromEnvironment('API_BASE_URL');
  static String get apiBaseUrl => resolveApiBaseUrl(environment, _override);

  static String resolveApiBaseUrl(String environment, String override) {
    if (!['development', 'production'].contains(environment)) {
      throw const FormatException('APP_ENV debe ser development o production');
    }
    final value = override.isNotEmpty ? override : environment == 'production' ? productionApiUrl : '';
    final uri = Uri.tryParse(value);
    if (uri != null && RegExp(r'^(?:\d{1,3}\.){3}x$', caseSensitive: false).hasMatch(uri.host)) {
      throw const FormatException('API_BASE_URL contiene una dirección de ejemplo. Para USB usa http://127.0.0.1:3000/api/v1 y activa adb reverse tcp:3000 tcp:3000.');
    }
    if (uri == null || !uri.hasAuthority || !['http', 'https'].contains(uri.scheme) ||
        uri.host.isEmpty ||
        uri.userInfo.isNotEmpty || uri.hasQuery || uri.hasFragment ||
        uri.path.replaceFirst(RegExp(r'/$'), '') != '/api/v1' ||
        (environment == 'production' && uri.scheme != 'https')) {
      throw const FormatException('Configura una API_BASE_URL válida; producción requiere HTTPS');
    }
    return value.replaceFirst(RegExp(r'/$'), '');
  }
  static const tileUrl = String.fromEnvironment('OSM_TILE_URL',
      defaultValue: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png');
}
