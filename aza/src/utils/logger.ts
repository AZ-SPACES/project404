/**
 * Centralised logger utility.
 *
 * In __DEV__ mode:  logs are prefixed and written to console (warn/error only).
 * In production:    errors are forwarded to Sentry; all console output is silent.
 *
 * Usage:
 *   import logger from '../utils/logger';
 *   logger.warn('something went wrong');
 *   logger.error('critical failure', error);  // pass Error for stack trace
 */

import * as Sentry from '@sentry/react-native';

const IS_DEV = __DEV__;

const noop = () => {};

function captureError(message: string, error?: unknown): void {
  const err =
    error instanceof Error ? error : new Error(String(error ?? message));
  Sentry.captureException(err, { extra: { message } });
}

const logger = {
  /** Verbose debugging — completely silent even in dev to keep terminal clean. */
  log: noop,

  /** Non-critical warnings. Shown in dev; silent in production. */
  warn: IS_DEV
    ? (message: string, ...args: unknown[]) =>
        console.warn(`[aza:warn] ${message}`, ...args)
    : noop,

  /**
   * Unexpected failures. Shown in dev; forwarded to Sentry in production.
   * Pass the original Error object as the second argument so Sentry can
   * use the stack trace for grouping and source-map deobfuscation.
   */
  error: IS_DEV
    ? (message: string, ...args: unknown[]) =>
        console.error(`[aza:error] ${message}`, ...args)
    : (message: string, error?: unknown) => captureError(message, error),
};

export default logger;
