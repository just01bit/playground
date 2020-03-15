const path = require('path');

const TemplateBase = require('../templateBase');
const { OPTION_PIPELINE } = require('../../constants');


module.exports = class PipelineTemplate extends TemplateBase {
    constructor(projectPath, generator) {
        super(projectPath, generator, __dirname);
    }

    async checkEnabled() {
        // root level project created by archetype in project template
        if (!this.options.add.has(OPTION_PIPELINE)) {
            return false;
        }

        if (this.options.force) {
            return true;
        }

        if (await this.fsUtil.pathExists(path.join(this.projectPath, 'Jenkinsfile')) ||
            await this.fsUtil.pathExists(path.join(this.projectPath, 'pipeline_config.yml'))) {
            throw new Error(`Pipeline support file exists. Use --force to overwrite.`);
        }

        return true;
    }

    async run() {
        super.run();

        await this.templateUtil.copyFiles('.', this.projectPath, {}, this.options.force);
    }

    async finalize() {
        this.logger.log('For information on the SAP Cloud SDK Pipeline see https://github.com/SAP/cloud-s4-sdk-pipeline');
    }
}
