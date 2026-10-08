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
    if (uri == null || !uri.hasAuthority || !['http', 'https'].contains(uri.scheme) ||
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
