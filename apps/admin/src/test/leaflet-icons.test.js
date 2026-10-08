import { expect, it } from 'vitest';
import { Icon } from 'leaflet';
import '../leaflet-icons';

it('los marcadores usan assets explícitos de Vite, sin rutas relativas inferidas', () => {
  const icon = new Icon.Default();
  const marker = icon.createIcon();
  const shadow = icon.createShadow();
  expect(marker.getAttribute('src')).toContain('marker-icon');
  expect(shadow.getAttribute('src')).toContain('marker-shadow');
  expect(marker.getAttribute('src')).not.toContain('undefined');
});
