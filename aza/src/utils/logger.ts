/**
 * Centralised logger utility.
 *
 * In __DEV__ mode:  logs are prefixed and written to console (warn/error only —
 *                   console.log is suppressed entirely so the terminal stays quiet).
 * In production:    all output is silenced (no leaking internals to the console).
 *
 * Usage:
 *   import logger from '../utils/logger';
 *   logger.warn('something went wrong', error);
 *   logger.error('critical failure', error);
 */

const IS_DEV = __DEV__;

const noop = () => {};

const logger = {
  /** Use for verbose debugging — completely silent even in dev to keep terminal clean. */
  log: noop,

  /** Non-critical warnings that shouldn't block the user. Shown in dev only. */
  warn: IS_DEV
    ? (message: string, ...args: unknown[]) =>
        console.warn(`[aza:warn] ${message}`, ...args)
    : noop,

  /** Unexpected failures that the developer must know about. Shown in dev only. */
  error: IS_DEV
    ? (message: string, ...args: unknown[]) =>
        console.error(`[aza:error] ${message}`, ...args)
    : noop,
};

export default logger;
