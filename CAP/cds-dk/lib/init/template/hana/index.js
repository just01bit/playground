const path = require('path');

const xmlJs = require("xml-js")

const cds = require('@sap/cds');

const TemplateBase = require('../templateBase');

const { OPTION_HANA, PROJECT_TYPE } = require('../../constants');

const DEBUG = process.env.DEBUG


module.exports = class HanaTemplate extends TemplateBase {
    constructor(projectPath, generator) {
        super(projectPath, generator, __dirname);

        this.folderPath = path.join(this.projectPath, cds.env.folders.db);
    }

    async checkEnabled() {
        // root level project created by archetype in project template
        if (!this.options.add.has(OPTION_HANA)) {
            return false;
        }

        if (this.options.force) {
            return true;
        }

        const hdiConfigPath = path.join(this.folderPath, 'src/.hdiconfig');
        if (await this.fsUtil.pathExists(hdiConfigPath)) {
            const configFilePath = path.relative(process.cwd(), hdiConfigPath);
            throw new Error(`Database config file ${configFilePath} already exists. Use --force to overwrite.`);
        }

        return true;
    }

    async run() {
        super.run();

        await this.templateUtil.copyFiles('.', this.folderPath, {
            projectName: this.projectName
        }, this.options.force);

        switch (await this.getProjectType()) {
            case PROJECT_TYPE.nodejs:
                await this._updatePackageJson(path.join(this.projectPath, 'package.json'), 'db');
                break;

            case PROJECT_TYPE.java:
                await this._updatePomXml(path.join(this.projectPath, cds.env.folders.srv, 'pom.xml'));
                break;

            default:
                break;
        }
    }

    async _updatePomXml(pomXmlPath) {
        if (await this.fsUtil.pathExists(pomXmlPath)) {
            const pomXmlContent = await this.fsUtil.readFile(pomXmlPath);

            const pomXml = xmlJs.xml2js(pomXmlContent, { compact: false, spaces: 4 });

            const project = pomXml.elements.find((elem) => {
                return elem.name === 'project';
            });
            if (!project) {
                this.logger.warn(`The file ${pomXmlPath} has no root tag '<project>'. Make sure it is a valid pom.xml file.`);
                return;
            }

            let dependencies = project.elements.find((elem) => {
                return elem.name === 'dependencies';
            });
            if (!dependencies) {
                dependencies = {
                    type: 'element',
                    name: 'dependencies',
                    elements: []
                }
                project.elements.push(dependencies);
            }

            const hanaEntry = dependencies.elements.find((elem) => {
                let counter = 0;
                elem.elements.forEach((innerElem) => {
                    if (innerElem.name === 'groupId' && innerElem.elements[0].text === 'com.sap.cds'
                        || innerElem.name === 'artifactId' && innerElem.elements[0].text === 'cds-feature-hana') {
                        counter++;
                    }
                });

                return counter === 2;
            });

            if (!hanaEntry) {
                dependencies.elements.push({
                    type: 'element',
                    name: 'dependency',
                    elements: [{
                        type: 'element',
                        name: 'groupId',
                        elements: [{
                            type: 'text',
                            text: 'com.sap.cds'
                        }]
                    }, {
                        type: 'element',
                        name: 'artifactId',
                        elements: [{
                            type: 'text',
                            text: 'cds-feature-hana'
                        }]
                    }]
                });

                const newXmlContent = xmlJs.js2xml(pomXml, { spaces: 4 });
                await this.fsUtil.writeFile(pomXmlPath, newXmlContent);
            }
        }
    }

    async _updatePackageJson(packageJsonPath, modelName) { //NOSONAR
        if (await this.fsUtil.pathExists(packageJsonPath)) {
            let changed;
            const packageJson = await this.fsUtil.readJSON(packageJsonPath);

            if (DEBUG) {
                this.logger.debug(`_updatePackageJson before: ${JSON.stringify(packageJson, null, 2)}`);
            }

            if (!packageJson.dependencies || (!packageJson.dependencies.hdb && !packageJson.dependencies['@sap/hana-client'])) {
                packageJson.dependencies = packageJson.dependencies || {};
                packageJson.dependencies['@sap/hana-client'] = '^2.4.177';
                changed = true;
            }

            packageJson.cds = packageJson.cds || {};
            packageJson.cds.requires = packageJson.cds.requires || {};
            packageJson.cds.requires[modelName] = packageJson.cds.requires[modelName] || {};

            if (packageJson.cds.requires[modelName].kind !== 'hana') {
                packageJson.cds.requires[modelName].kind = 'hana';
                changed = true;
            }

            if (changed) {
                await this.fsUtil.writeJSON(packageJsonPath, packageJson);
            }

            if (DEBUG) {
                this.logger.debug(`_updatePackageJson written: ${JSON.stringify(packageJson, null, 2)}`);
            }
        }
    }
}
