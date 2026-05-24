/**
 * Structured JSON logger for the keeper bot.
 * All output goes to stdout via process.stdout.write — never console.log.
 * Private keys, raw transaction data, and wallet balances must never be logged.
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    [key: string]: unknown;
}

function write(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        ...meta,
    };
    process.stdout.write(JSON.stringify(entry) + '\n');
}

export const log = write

export const logger = {
    info:  (message: string, meta?: Record<string, unknown>): void => write('info',  message, meta),
    warn:  (message: string, meta?: Record<string, unknown>): void => write('warn',  message, meta),
    error: (message: string, meta?: Record<string, unknown>): void => write('error', message, meta),
    debug: (message: string, meta?: Record<string, unknown>): void => write('debug', message, meta),
};
