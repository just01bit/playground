'use strict';

const Async = require('./UtilsAsync');
const Utils = require('./Utils');

/**
 * Executes the entries in the task list of the store until the list is empty.
 * The task are executed asynchronously.
 */
class TaskProcessor {

    /**
     * Constructor
     * @param {FunctionSet} functions Function set for processing the tasks
     * @param {DataStore} store Store containing the task list
     * @param {Object} options Options
     * @param {Object} options.logger A logger instance
     */
    constructor(functions, store, options = {}) {
        this._store = store;
        this._functions = functions;
        this._logger = options.logger;
        this._counter = 0;
    }

    /**
     * Merge an elements target into the parent element target, if a dedicated function is available for the merge, then
     * this function is used
     * @param {Element} element
     */
    merge(element) {
        const data = element.getData();

        let func = this._functions.getFunction(data.uri, 'merge' + data.local);
        if (func) {
            // call custom merge function
            this.logDebug(`Merge ${Utils.padEnd(data.local, 30)} (${data.uri})`);
            this._functions[func](element);
        } else {
            // apply default merge function
            element.mergeSubElementsTargetsToOwnTarget();
        }

        const parent = element.getParentElement();
        if (element._finished && parent) {
            // go recursively up the parent chain
            this.merge(parent);
        }
    }

    /**
     * Process an element from the AsyncTaskList. There is an additional recursion gate which
     * fails after a task has been re-executed for 5 times.
     * @param {Element} element Element to be processed
     * @param {Function} callback Callback function
     * @returns {undefined}
     */
    processElement(element, callback) {
        const tK = element.getTargetKey();
        // Gate check
        this._counter++;

        if (element.getCallCount() > 10) {
            let msg = 'Processing of element ';
            msg += element.getFunctionName() + ' ';
            if (tK) {
                msg += 'with name ' + element.getNamespace() + '.' + tK + ' ';
            }
            msg += 'failed';
            throw new Error(msg);
        }

        const name = element.getFunctionName();
        this.logDebug(`Async ${name} ` + (tK || ''));
        let func = this._functions.getFunction('ASYNC', 'async' + name);

        element.setHasAsyncJob(false);

        return this._functions[func](element, () => {
            if (!element._hasAsyncJob && element.getSubElements().size === 0) {
                element.finished();
            }

            const parent = element.getParentElement();
            if (element._finished && parent) {
                this.merge(parent);
            }
            return callback();
        });
    }

    /**
     * Loop until the AsyncTaskList of the store is empty or an error occurs.
     * @param {Function} callback
     * @returns {undefined}
     */
    buildJsonTree(callback) {
        const taskList = this._store.getAsyncTaskList();

        const taskExecutor = (task, cb) => {
            return this.processElement(task, cb);
        };

        return Async.processArrayUntilEmpty(taskList, taskExecutor, (err) => {
            this.logDebug('TaskProcessor finished');
            return callback(err);
        });
    }

    /**
     * Log info if logger is available
     * @param {string} info
     */
    logDebug(info) {
        if (this._logger) {
            this._logger.debug(info);
        }
    }
}


module.exports = TaskProcessor;
