const commandUtil = require('./commandUtil');


module.exports = class NpmUtil {
    constructor(logger) {
        this.logger = logger;
    }

    async install(cwd = process.cwd()) {
        await commandUtil.spawnCommand('npm', ['install'], {
            cwd
        }, this.logger);
    }
}
