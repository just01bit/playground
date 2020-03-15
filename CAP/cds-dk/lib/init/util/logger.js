/* eslint no-console: 0 */

class DefaultLogger {
    debug(message = '') {
        if (process.env.DEBUG) {
            console.debug(message);
        }
    }

    log(message = '') {
        console.log(message);
    }

    warn(message = '') {
        console.warn(message);
    }

    error(message = '') {
        console.error(message);
    }
}

class NullLogger {
    debug() { }
    log() { }
    warn() { }
    error() { }
    write() { }
}

module.exports = {
    defaultLogger: new DefaultLogger(),
    nullLogger: new NullLogger()
}
