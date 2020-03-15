const cp = require('child_process');
const os = require('os');
const util = require('util');

const { nullLogger } = require('./logger');

const execAsync = util.promisify(cp.exec);

class CommandUtil {

    /**
     * Execute a command and show output in console, if verbose
     * spawn has problems with promisify so use native approach w/ Promise
     * @param cmd command
     * @param args command args
     * @param options spawn options
     * @param logger logger to use
     *
     * @returns Promise
     */
    async spawnCommand(cmd, args, options, logger) {
        args = this._sanitizeArgs(args);
        return new Promise((resolve, reject) => {
            logger.debug(`${cmd} ${args.join(' ')}`);

            options = options || {};
            options.env = options.env || process.env;

            const spawnOptions = {
                ...options,
                shell: (os.platform() === 'win32'), // for windows only
                stdio: (logger === nullLogger ? 'ignore' : 'inherit') // pipe to host stdio if not quiet
            }

            const child = cp.spawn(cmd, args, spawnOptions);

            child.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`${cmd} ${args.join(' ')} failed with code ${code}`));
                }
            });

            child.on('error', (err) => {
                reject(err);
            });
        });
    }

    /**
    * Execute a command and capture output.
    * @param cmd command
    * @param args command args
    * @param options spawn options
    * @param logger logger to use
    *
    * @returns { stdout, stderr }
    */
    async executeCommand(cmd, args, options, logger) {
        args = this._sanitizeArgs(args);

        options = options || {};
        options.env = options.env || process.env;

        logger.debug(`${cmd} ${args.join(' ')}`);

        return await execAsync(`${cmd} ${args.join(' ')}`, {
            ...options,
            shell: (os.platform() === 'win32')
        });
    }

    _sanitizeArgs(args) {
        const result = [];
        for (const arg of args) {
            result.push(arg.replace(/[&;|]/g, ''));
        }
        return result;
    }
}

module.exports = new CommandUtil();
