'use strict';

class UtilsAsync {

    /**
     * Calls a function for each entry of an array, this is repeated until the array is empty.
     * The function which is called asynchronously may have a own reference to the array, and can add new entries.
     * @param {Array<Object>} array Array whose entries are to be processed asynchronously by the processorFunction
     * @param {Function} processorFunction Function to be called for each array elements. The functions first parameter
     * is the element, the second parameter the callback.
     * @param {Function} callback Callback to be called after the array is empty
     * @returns {undefined}
     */
    static processArrayUntilEmpty(array, processorFunction, callback) {

        const _processNextEntry = (cb) => {
            const entry = array.shift();
            if (!entry) return callback(); // Array empty, stop processing

            // Process element
            return processorFunction(entry, (err) => {
                if (err) return callback(err);
                return process.nextTick(() => _processNextEntry(cb));
            });
        };

        return _processNextEntry(callback);
    }
}

module.exports = UtilsAsync;
