const os = require('os');
const path = require('path');

const cds = require('@sap/cds');
const fse = require('@sap/cds-foss')('fs-extra')


const commandUtil = require('../../util/commandUtil');
const mvnArchetypes = require('../../util/mvnArchetypeUtil');

const TemplateBase = require('../templateBase');
const { OPTION_JAVA, REGEX_JAVA_PACKAGE } = require('../../constants');


module.exports = class ProjectTemplate extends TemplateBase {
    constructor(projectPath, generator) {
        super(projectPath, generator, __dirname);
    }

    getPriority() {
        return Number.MAX_VALUE;
    }

    async checkEnabled() { //NOSONAR
        if (this.options.force) {
            return true;
        }

        const findProjectFile = await this._findProjectFile();
        if (findProjectFile) {
            throw new Error(`Found file '${findProjectFile}' in the project folder which might indicate an existing project. Use --force to overwrite.`);
        }

        if (this.options.add.has(OPTION_JAVA)) {
            if (this.options['java:package']) {
                if (!REGEX_JAVA_PACKAGE.test(this.options['java:package'])) {
                    throw new Error(`Invalid Java package. Use --force to use anyway.`);
                }
            } else {
                if (!this.options['java:package'] && !REGEX_JAVA_PACKAGE.test(this.projectName)) {
                    throw new Error(`Project name is not a valid Java package name. Use --force to use anyway or specify alternative package using --java:package.`);
                }
            }

        } else {
            if (this.options['java:package']) {
                this.logger.warn(`Specified Java package will be ignored since project type is not Java. Use --add java to create project type Java.`);
            }
        }

        return true;
    }

    async run() {
        if (this.options.add.has(OPTION_JAVA)) {
            // creates root level project
            await this._createProjectTypeJava();
        } else {
            await this._createCommonFiles();
            await this._createProjectTypeNodejs();
        }
    }

    async finalize() {
        const relativeProjectPath = path.relative(process.cwd(), this.projectPath);
        if (relativeProjectPath && relativeProjectPath !== '.') {
            this.logger.log(`Continue with 'cd ${relativeProjectPath}'`);
        }

        if (!this.options.add.has(OPTION_JAVA)) {
            this.logger.log(`Find samples on https://github.com/SAP-samples/cloud-cap-samples`);
        }

        this.logger.log(`Learn about next steps at https://cap.cloud.sap/docs/get-started`);
    }

    async _createCommonFiles() {
        await this.templateUtil.copyFiles('common', this.projectPath, {
            projectName: this.projectName
        }, this.options.force);

        await this.templateUtil.copyFiles('vscode', this.projectPath, {}, this.options.force);
    }

    async _createProjectTypeNodejs() {
        const values = {
            projectName: this.projectName
        }
        await this.templateUtil.copyFiles('nodejs', this.projectPath, values, this.options.force);

        const dbFolderPath = path.join(this.projectPath, cds.env.folders.db);
        await this.fsUtil.mkdirp(dbFolderPath);

        const srvFolderPath = path.join(this.projectPath, cds.env.folders.srv);
        await this.fsUtil.mkdirp(srvFolderPath);

        const appFolderPath = path.join(this.projectPath, cds.env.folders.app);
        await this.fsUtil.mkdirp(appFolderPath);

        // used to call npm install here
    }

    async _createProjectTypeJava() {
        const mvnCmdArgs = mvnArchetypes.getCmdArgs(this.projectName, this.options);

        const tempFolder = await this._mkTempFolder(`${this.projectName}_`);
        try {
            await commandUtil.spawnCommand('mvn', mvnCmdArgs, {
                cwd: tempFolder
            }, this.logger);

            await this.fsUtil.copy(tempFolder, path.dirname(this.projectPath));
        } finally {
            await fse.remove(tempFolder);
        }
    }

    async _mkTempFolder(suffix) {
        return await fse.mkdtemp(path.join(os.tmpdir(), suffix));
    }

    async _findProjectFile() {
        const projectFiles = ['package.json', 'pom.xml', '.cdsrc.json'];

        for (const file of projectFiles) {
            if (await this.fsUtil.pathExists(path.join(this.projectPath, file))) {
                return file;
            }
        }

        return null;
    }
}
