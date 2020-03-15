'use strict';

/**
 * Call given callback with an new Error with the given message or log the message and exit process
 * @param {Logger} logger Logger instance containing a .error function
 * @param {string} [message] Message to be logged
 * @param {ConverterCallback} cb Callback
 * @param {Array<{namespace: string, uri:string }>} [missingNamespaces] List if missing namespaces
 * @private
 */
module.exports.exitOrCallback = (logger, message, cb, missingNamespaces) => {
    // exit with error
    if (message) {
        if (cb) {
            cb(new Error(message), null, missingNamespaces);
            return;
        }
        logger.error(message);
        process.exit(1);
    }

    // non error exit
    if (cb) {
        cb();
        return;
    }
    process.exit(0);
};
