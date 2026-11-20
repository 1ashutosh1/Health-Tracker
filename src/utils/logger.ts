/**
 * The one place the app writes to the console, so there is a single switch for it.
 * `debug` is development chatter and is silent in tests and release builds.
 * `warn` and `error` are for things that went wrong but were handled. Nothing here is sent anywhere.
 */
export const logger = {
  debug: (message: string): void => {
    if (__DEV__ && process.env.NODE_ENV !== 'test') console.log(message);
  },
  warn: (message: string, detail?: unknown): void => {
    console.warn(message, detail);
  },
  error: (message: string, detail?: unknown): void => {
    console.error(message, detail);
  },
};
