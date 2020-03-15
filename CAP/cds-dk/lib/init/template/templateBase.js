const path = require('path');

const TemplateUtil = require('../util/templateUtil');
const { PROJECT_TYPE } = require('../constants');


module.exports = class TemplateBase {
    constructor(projectPath, generator, dirName) {
        this.projectPath = path.resolve(projectPath);
        this.options = generator.options;
        this.fsUtil = generator.fsUtil;
        this.logger = generator.logger;
        this.npmUtil = generator.npmUtil;

        this.name = this.constructor.name.replace(/template/i, '').toLowerCase();

        this.projectName = path.basename(this.projectPath);
        this.templateUtil = new TemplateUtil(path.join(dirName, 'files'), this.fsUtil);
    }

    /**
     * Checks whether the given template should handle this request
     * @returns true, if template should handle this request
     * @throws Error, if request is invalid
     */
    async checkEnabled() {
        return true;
    }

    /**
     * Executes the given template.
     * @throws Error, if handling failed.
     */
    async run() {
        this.logger.log(`> applying template '${this.name}'...`);
    }

    /**
     * Called when generation is finished
     */
    async finalize() {
    }

    /**
     * Get priority for this template as number, where
     * 0 is default, positive number means higher, and negative number
     * lower priority.
     * Use Number.MAX_VALUE or -Number.MAX_VALUE
     * @returns the priority for this template as number
     */
    getPriority() {
        return 0;
    }

    /**
     * Returns the project type
     * @see PROJECT_TYPE
     * @returns PROJECT_TYPE for current project
     */
    async getProjectType() {
        if (await this.fsUtil.pathExists(path.join(this.projectPath, 'pom.xml'))) {
            return PROJECT_TYPE.java;
        }

        if (await this.fsUtil.pathExists(path.join(this.projectPath, 'package.json'))) {
            return PROJECT_TYPE.nodejs;
        }

        return PROJECT_TYPE.unknown;
    }
}
