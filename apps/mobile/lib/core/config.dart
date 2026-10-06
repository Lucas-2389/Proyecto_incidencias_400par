class AppConfig {
  static const apiBaseUrl = String.fromEnvironment('API_BASE_URL');
  static const tileUrl = String.fromEnvironment('OSM_TILE_URL',
      defaultValue: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png');
}
