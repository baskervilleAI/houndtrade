/**
 * Centralized logging utility for HoundTrade
 * Allows for easy control of log levels and debugging
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  VERBOSE = 4
}

class Logger {
  private static instance: Logger;
  private currentLevel: LogLevel = LogLevel.INFO;
  private enabledModules: Set<string> = new Set();

  constructor() {
    // Set log level based on environment
    if (process.env.NODE_ENV === 'development') {
      this.currentLevel = LogLevel.DEBUG;
    } else {
      this.currentLevel = LogLevel.WARN;
    }

    // Enable specific modules for debugging
    // this.enabledModules.add('streaming');
    // this.enabledModules.add('chart');
    // this.enabledModules.add('market');
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private shouldLog(level: LogLevel, module?: string): boolean {
    // Check level first
    if (level > this.currentLevel) {
      return false;
    }

    // If module is specified, check if it's enabled for verbose logging
    if (module && level === LogLevel.VERBOSE) {
      return this.enabledModules.has(module);
    }

    return true;
  }

  error(message: string, data?: any, module?: string): void {
    if (this.shouldLog(LogLevel.ERROR, module)) {
      console.error(`❌ ${message}`, data);
    }
  }

  warn(message: string, data?: any, module?: string): void {
    if (this.shouldLog(LogLevel.WARN, module)) {
      console.warn(`⚠️ ${message}`, data);
    }
  }

  info(message: string, data?: any, module?: string): void {
    if (this.shouldLog(LogLevel.INFO, module)) {
      console.log(`ℹ️ ${message}`, data);
    }
  }

  debug(message: string, data?: any, module?: string): void {
    if (this.shouldLog(LogLevel.DEBUG, module)) {
      console.log(`🐛 ${message}`, data);
    }
  }

  verbose(message: string, data?: any, module?: string): void {
    if (this.shouldLog(LogLevel.VERBOSE, module)) {
      console.log(`📝 ${message}`, data);
    }
  }

  // Specialized logging methods for different modules
  streaming = {
    info: (message: string, data?: any) => this.info(message, data, 'streaming'),
    debug: (message: string, data?: any) => this.debug(message, data, 'streaming'),
    verbose: (message: string, data?: any) => this.verbose(message, data, 'streaming'),
    error: (message: string, data?: any) => this.error(message, data, 'streaming'),
    warn: (message: string, data?: any) => this.warn(message, data, 'streaming'),
  };

  chart = {
    info: (message: string, data?: any) => this.info(message, data, 'chart'),
    debug: (message: string, data?: any) => this.debug(message, data, 'chart'),
    verbose: (message: string, data?: any) => this.verbose(message, data, 'chart'),
    error: (message: string, data?: any) => this.error(message, data, 'chart'),
    warn: (message: string, data?: any) => this.warn(message, data, 'chart'),
  };

  market = {
    info: (message: string, data?: any) => this.info(message, data, 'market'),
    debug: (message: string, data?: any) => this.debug(message, data, 'market'),
    verbose: (message: string, data?: any) => this.verbose(message, data, 'market'),
    error: (message: string, data?: any) => this.error(message, data, 'market'),
    warn: (message: string, data?: any) => this.warn(message, data, 'market'),
  };

  // Control methods
  setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  enableModule(module: string): void {
    this.enabledModules.add(module);
  }

  disableModule(module: string): void {
    this.enabledModules.delete(module);
  }

  setQuietMode(): void {
    this.currentLevel = LogLevel.ERROR;
  }

  setVerboseMode(): void {
    this.currentLevel = LogLevel.VERBOSE;
    this.enabledModules.add('streaming');
    this.enabledModules.add('chart');
    this.enabledModules.add('market');
  }
}

export const logger = Logger.getInstance();
export default logger;
