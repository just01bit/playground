'use strict';
/* eslint-disable no-console */

/**
 * Log console output to command line
 */
class Logger {

    /**
     * Constructor
     * @param {Logger.OPTION_MAP} level
     */
    constructor(level) {
        this._level = level;
    }

    /**
     * Set setLogLevel
     * @param {Logger.OPTION_MAP} level
     */
    setLogLevel(level) {
        this._level = level;
    }

    /**
     * Log information, logs only if level is DEBUG or more
     * @param {string} logString
     */
    debug(logString) {
        if (this._level >= Logger.DEBUG) console.log('DEBUG - ' + logString);
    }

    /**
     * Log information, logs only if level is DEBUG or more
     * @param {string} logString
     */
    path(logString) {
        if (this._level >= Logger.DEBUG) console.log('PATH - ' + logString);

    }

    /**
     * Log information, logs only if level is INFO or more
     * @param {string} logString
     * @param {bool} [force] If true logs always
     */
    info(logString, force) {
        if (force || this._level >= Logger.INFO) console.log('INFO - ' + logString);
    }

    /**
     * Log warning
     * @param {string} logString
     */
    warning(logString) {
        console.log('WARN - ' + logString);
    }

    /**
     * Log error message
     * @param {string} logString
     */
    error(logString) {
        console.error('ERROR - ' + logString);
    }
}

Logger.ERROR = 0;
Logger.INFO = 1;
Logger.DEBUG = 2;

/**
 * List of supported log levels
 * @readonly
 * @enum {number}
 */
Logger.OPTION_MAP = {
    d: Logger.DEBUG,
    debug: Logger.DEBUG,
    i: Logger.INFO,
    info: Logger.INFO,
    e: Logger.ERROR,
    error: Logger.ERROR
};

module.exports = Logger;
