import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

// jpeg-js ships no type declarations; require keeps it self-contained.
const jpeg = require('jpeg-js') as {
  decode: (data: Uint8Array, opts?: { useTArray?: boolean }) => {
    width: number;
    height: number;
    data: Uint8Array;
  };
};

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const len = clean.length;
  const bytes = new Uint8Array(Math.floor((len * 3) / 4));
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const c0 = B64.indexOf(clean[i]!);
    const c1 = B64.indexOf(clean[i + 1]!);
    const c2 = B64.indexOf(clean[i + 2]!);
    const c3 = B64.indexOf(clean[i + 3]!);
    bytes[p++] = (c0 << 2) | (c1 >> 4);
    if (c2 !== -1) bytes[p++] = ((c1 & 15) << 4) | (c2 >> 2);
    if (c3 !== -1) bytes[p++] = ((c2 & 3) << 6) | c3;
  }
  return bytes.subarray(0, p);
}

/**
 * Returns the average perceived luminance (0 = black, 1 = white) of an image.
 * The image is downscaled to a tiny thumbnail first so decoding stays cheap.
 * Returns null if the image can't be read.
 */
export async function computeImageLuminance(uri: string): Promise<number | null> {
  let downloaded: string | null = null;
  try {
    // manipulateAsync needs a local file; pull remote wallpapers into cache first.
    let source = uri;
    if (uri.startsWith('http://') || uri.startsWith('https://')) {
      const target = `${FileSystem.cacheDirectory ?? ''}lum_${Date.now()}.img`;
      const res = await FileSystem.downloadAsync(uri, target);
      source = downloaded = res.uri;
    }
    const out = await manipulateAsync(source, [{ resize: { width: 16, height: 16 } }], {
      compress: 0.6,
      format: SaveFormat.JPEG,
      base64: true,
    });
    if (!out.base64) return null;
    const { data } = jpeg.decode(base64ToBytes(out.base64), { useTArray: true });
    let sum = 0;
    let n = 0;
    for (let i = 0; i + 2 < data.length; i += 4) {
      // Rec. 601 perceived luminance, normalised to 0..1
      sum += (0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!) / 255;
      n++;
    }
    return n > 0 ? sum / n : null;
  } catch {
    return null;
  } finally {
    if (downloaded) FileSystem.deleteAsync(downloaded, { idempotent: true }).catch(() => {});
  }
}

type Palette = { text: string; soft: string; pill: string };

const DARK_BG: Palette = {
  // white text — for dark / mid wallpapers (and gradient banners)
  text: '#FFFFFF',
  soft: 'rgba(255,255,255,0.8)',
  pill: 'rgba(0,0,0,0.28)',
};

const LIGHT_BG: Palette = {
  // near-black text — for bright wallpapers
  text: '#0A0A0A',
  soft: 'rgba(0,0,0,0.6)',
  pill: 'rgba(255,255,255,0.55)',
};

// Above this effective luminance the wallpaper is treated as "bright" and we
// flip to dark text. Conservative so busy/mid images keep white text + scrim.
const BRIGHT_THRESHOLD = 0.62;

export type AdaptiveForeground = {
  /** which text tone is in use */
  tone: 'light-text' | 'dark-text';
  /** palette for elements sitting directly on the wallpaper (header) */
  header: Palette;
  /** palette for the balance/actions area (forced white when a card backs it) */
  balance: Palette;
  /** protective gradient scrim, top → middle → bottom */
  scrim: [string, string, string];
};

/**
 * Derives readable foreground colours for content laid over a wallpaper.
 * `dim` is the user's dark-overlay opacity (0..1) which darkens the image, so
 * it's factored into the effective luminance. When `active` is false (no image
 * wallpaper, e.g. a gradient banner) it always returns the white-text palette.
 */
export function getAdaptiveForeground(opts: {
  luminance: number | null;
  dim: number;
  active: boolean;
  cardBacking: boolean;
}): AdaptiveForeground {
  const { luminance, dim, active, cardBacking } = opts;
  const effective = luminance == null ? null : luminance * (1 - dim);
  const bright = active && effective != null && effective > BRIGHT_THRESHOLD;

  return {
    tone: bright ? 'dark-text' : 'light-text',
    header: bright ? LIGHT_BG : DARK_BG,
    // A dark glass/solid card behind the balance keeps white text legible.
    balance: bright && !cardBacking ? LIGHT_BG : DARK_BG,
    scrim: bright
      ? ['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0.35)']
      : ['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.05)', 'rgba(0,0,0,0.45)'],
  };
}
