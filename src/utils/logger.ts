type LogLevel = 'info' | 'warn' | 'error';

class Logger {
  private log(level: LogLevel, message: string, ...args: unknown[]) {
    // In the future, this can be integrated with a remote monitoring service
    if (process.env.NODE_ENV !== 'production' || level === 'error') {
      console[level](`[${level.toUpperCase()}] ${message}`, ...args);
    }
  }

  info(message: string, ...args: unknown[]) {
    this.log('info', message, ...args);
  }

  warn(message: string, ...args: unknown[]) {
    this.log('warn', message, ...args);
  }

  error(message: string, ...args: unknown[]) {
    this.log('error', message, ...args);
  }
}

export const logger = new Logger();
