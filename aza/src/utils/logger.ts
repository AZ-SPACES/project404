/**
 * Centralised logger utility.
 *
 * In __DEV__ mode:  logs are prefixed and written to console (warn/error only).
 * In production:    all output is silent.
 */

const IS_DEV = __DEV__;

const noop = () => {};

const logger = {
  /** Verbose debugging — completely silent even in dev to keep terminal clean. */
  log: noop,

  /** Non-critical warnings. Shown in dev; silent in production. */
  warn: IS_DEV
    ? (message: string, ...args: unknown[]) =>
        console.warn(`[aza:warn] ${message}`, ...args)
    : noop,

  /** Unexpected failures. Shown in dev; silent in production. */
  error: IS_DEV
    ? (message: string, ...args: unknown[]) =>
        console.error(`[aza:error] ${message}`, ...args)
    : noop,
};

export default logger;
