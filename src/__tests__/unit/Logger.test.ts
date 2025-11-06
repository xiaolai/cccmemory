/**
 * Unit tests for Logger
 */

import { jest } from '@jest/globals';
import { Logger, LogLevel, createLogger } from '../../utils/Logger';

describe('Logger', () => {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalDebug = console.debug;

  let consoleLogMock: ReturnType<typeof jest.fn>;
  let consoleWarnMock: ReturnType<typeof jest.fn>;
  let consoleErrorMock: ReturnType<typeof jest.fn>;
  let consoleDebugMock: ReturnType<typeof jest.fn>;

  beforeEach(() => {
    consoleLogMock = jest.fn();
    consoleWarnMock = jest.fn();
    consoleErrorMock = jest.fn();
    consoleDebugMock = jest.fn();

    console.log = consoleLogMock;
    console.warn = consoleWarnMock;
    console.error = consoleErrorMock;
    console.debug = consoleDebugMock;
  });

  afterEach(() => {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
    console.debug = originalDebug;
  });

  describe('Log Levels', () => {
    it('should log debug messages when level is DEBUG', () => {
      const logger = new Logger({ level: LogLevel.DEBUG });
      logger.debug('test debug');

      expect(consoleDebugMock).toHaveBeenCalledWith(
        expect.stringContaining('[DEBUG] test debug')
      );
    });

    it('should not log debug messages when level is INFO', () => {
      const logger = new Logger({ level: LogLevel.INFO });
      logger.debug('test debug');

      expect(consoleDebugMock).not.toHaveBeenCalled();
    });

    it('should log info messages when level is INFO', () => {
      const logger = new Logger({ level: LogLevel.INFO });
      logger.info('test info');

      expect(consoleLogMock).toHaveBeenCalledWith(
        expect.stringContaining('[INFO] test info')
      );
    });

    it('should log warnings when level is WARN', () => {
      const logger = new Logger({ level: LogLevel.WARN });
      logger.warn('test warning');

      expect(consoleWarnMock).toHaveBeenCalledWith(
        expect.stringContaining('[WARN] test warning')
      );
    });

    it('should not log info when level is WARN', () => {
      const logger = new Logger({ level: LogLevel.WARN });
      logger.info('test info');

      expect(consoleLogMock).not.toHaveBeenCalled();
    });

    it('should log errors when level is ERROR', () => {
      const logger = new Logger({ level: LogLevel.ERROR });
      logger.error('test error');

      expect(consoleErrorMock).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] test error')
      );
    });

    it('should not log anything when level is SILENT', () => {
      const logger = new Logger({ level: LogLevel.SILENT });
      logger.debug('debug');
      logger.info('info');
      logger.warn('warn');
      logger.error('error');

      expect(consoleDebugMock).not.toHaveBeenCalled();
      expect(consoleLogMock).not.toHaveBeenCalled();
      expect(consoleWarnMock).not.toHaveBeenCalled();
      expect(consoleErrorMock).not.toHaveBeenCalled();
    });
  });

  describe('Formatting', () => {
    it('should include prefix when configured', () => {
      const logger = new Logger({ prefix: 'TestModule', level: LogLevel.INFO });
      logger.info('test message');

      expect(consoleLogMock).toHaveBeenCalledWith(
        expect.stringContaining('[TestModule]')
      );
    });

    it('should include timestamp when configured', () => {
      const logger = new Logger({ timestamp: true, level: LogLevel.INFO });
      logger.info('test message');

      expect(consoleLogMock).toHaveBeenCalledWith(
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
      );
    });

    it('should format with all components', () => {
      const logger = new Logger({
        prefix: 'Test',
        timestamp: true,
        level: LogLevel.INFO,
      });
      logger.info('message');

      const call = consoleLogMock.mock.calls[0][0] as string;
      expect(call).toMatch(/^\d{4}/); // Timestamp
      expect(call).toContain('[Test]'); // Prefix
      expect(call).toContain('[INFO]'); // Level
      expect(call).toContain('message'); // Message
    });
  });

  describe('Child Loggers', () => {
    it('should create child logger with combined prefix', () => {
      const parent = new Logger({ prefix: 'Parent', level: LogLevel.INFO });
      const child = parent.child('Child');

      child.info('test');

      expect(consoleLogMock).toHaveBeenCalledWith(
        expect.stringContaining('[Parent:Child]')
      );
    });

    it('should inherit log level from parent', () => {
      const parent = new Logger({ level: LogLevel.ERROR });
      const child = parent.child('Child');

      child.info('should not log');
      child.error('should log');

      expect(consoleLogMock).not.toHaveBeenCalled();
      expect(consoleErrorMock).toHaveBeenCalled();
    });
  });

  describe('Dynamic Level Changes', () => {
    it('should allow changing log level', () => {
      const logger = new Logger({ level: LogLevel.ERROR });

      logger.info('not logged');
      expect(consoleLogMock).not.toHaveBeenCalled();

      logger.setLevel(LogLevel.INFO);
      logger.info('now logged');
      expect(consoleLogMock).toHaveBeenCalled();
    });

    it('should return current log level', () => {
      const logger = new Logger({ level: LogLevel.WARN });
      expect(logger.getLevel()).toBe(LogLevel.WARN);

      logger.setLevel(LogLevel.DEBUG);
      expect(logger.getLevel()).toBe(LogLevel.DEBUG);
    });
  });

  describe('Success Messages', () => {
    it('should log success messages at INFO level', () => {
      const logger = new Logger({ level: LogLevel.INFO });
      logger.success('operation complete');

      expect(consoleLogMock).toHaveBeenCalledWith(
        expect.stringContaining('[✓] operation complete')
      );
    });

    it('should not log success when level is WARN', () => {
      const logger = new Logger({ level: LogLevel.WARN });
      logger.success('operation complete');

      expect(consoleLogMock).not.toHaveBeenCalled();
    });
  });

  describe('Additional Arguments', () => {
    it('should pass additional arguments to console', () => {
      const logger = new Logger({ level: LogLevel.INFO });
      const obj = { foo: 'bar' };
      logger.info('message', obj, 123);

      expect(consoleLogMock).toHaveBeenCalledWith(
        expect.any(String),
        obj,
        123
      );
    });
  });

  describe('Factory Function', () => {
    it('should create logger with module prefix', () => {
      const logger = createLogger('MyModule');
      logger.info('test');

      expect(consoleLogMock).toHaveBeenCalledWith(
        expect.stringContaining('[MyModule]')
      );
    });
  });
});
