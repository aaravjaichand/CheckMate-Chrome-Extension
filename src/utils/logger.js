/**
 * Logger utility with environment-aware logging
 * In production, only errors are logged. In development, all logs are shown.
 */

const isDev = process.env.NODE_ENV !== 'production';

const logger = {
  /**
   * Log debug information (dev only)
   */
  debug: (...args) => {
    if (isDev) {
      console.log('[DEBUG]', ...args);
    }
  },

  /**
   * Log general information (dev only)
   */
  info: (...args) => {
    if (isDev) {
      console.log('[INFO]', ...args);
    }
  },

  /**
   * Log warnings (dev only)
   */
  warn: (...args) => {
    if (isDev) {
      console.warn('[WARN]', ...args);
    }
  },

  /**
   * Log errors (always logged)
   */
  error: (...args) => {
    console.error('[ERROR]', ...args);
  }
};

export default logger;

