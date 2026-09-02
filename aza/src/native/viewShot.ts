import type { captureRef as captureRefType } from 'react-native-view-shot';

import { loadOptionalModule, NativeModuleUnavailableError } from './optional';

type ViewShotModule = typeof import('react-native-view-shot');

/** `undefined` = not tried yet, `null` = not in this binary. */
let cached: ViewShotModule | null | undefined;

function load(): ViewShotModule | null {
  if (cached === undefined) {
    cached = loadOptionalModule(() => require('react-native-view-shot') as ViewShotModule);
  }
  return cached;
}

export function isViewShotAvailable(): boolean {
  return load() !== null;
}

/**
 * Rasterise a view, or reject with a message naming the missing capability.
 *
 * Every caller — the QR poster, the receipt, the chat media composite — already
 * treats a failed capture as "share the text instead", so a rejected promise
 * lands on a path that exists rather than on an error screen.
 */
export const captureRef: typeof captureRefType = (view, options) => {
  const mod = load();
  if (!mod) {
    return Promise.reject(new NativeModuleUnavailableError('Saving an image of the screen'));
  }
  return mod.captureRef(view, options);
};
