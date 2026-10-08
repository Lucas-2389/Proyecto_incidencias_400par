import { Icon } from 'leaflet';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

// Vite emits these files with hashed URLs; Leaflet must not guess relative paths.
Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });
Icon.Default.prototype._getIconUrl = function (name) { return this.options[`${name}Url`]; };
