import type { StyleSpecification } from "maplibre-gl";

// OpenStreetMap raster tiles, restyled dark inside the map itself: brightness
// min/max are swapped (which inverts the image), hue is rotated back so parks
// stay green and water stays blue, and the result is desaturated and laid at
// reduced opacity over the app's navy. No tile API key is needed.
//
// Tiles come through our own caching proxy (/api/tiles) so they load from disk
// after the first fetch. NEXT_PUBLIC_MAP_TILES can point straight at another
// {z}/{x}/{y} raster source instead.
const origin = typeof window !== "undefined" ? window.location.origin : "";
const tiles = process.env.NEXT_PUBLIC_MAP_TILES || `${origin}/api/tiles/{z}/{x}/{y}`;

export const MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    base: {
      type: "raster",
      tiles: [tiles],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#0B1220" } },
    {
      id: "base",
      type: "raster",
      source: "base",
      paint: {
        "raster-brightness-min": 1,
        "raster-brightness-max": 0,
        "raster-hue-rotate": 180,
        "raster-saturation": -0.45,
        "raster-contrast": 0.12,
        "raster-opacity": 0.78,
        "raster-fade-duration": 200,
      },
    },
  ],
};

/** Greater Peshawar: every seeded area fits inside with a little margin. */
export const PESHAWAR_BOUNDS: [[number, number], [number, number]] = [
  [71.4, 33.942],
  [71.625, 34.104],
];
