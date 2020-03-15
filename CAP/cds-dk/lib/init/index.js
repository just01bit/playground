const path = require('path');

const { defaultLogger } = require('./util/logger');
const FsUtil = require('./util/fsUtil');
const NpmUtil = require('./util/npmUtil');

const { OPTION_HANA, OPTION_JAVA, OPTION_MTA, OPTION_PIPELINE } = require('./constants');

const DEBUG = process.env.DEBUG;

module.exports = class CDSGenerator {
    constructor(fsUtil, logger, npmUtil) {
        this.fsUtil = fsUtil || new FsUtil();
        this.logger = logger || defaultLogger;
        this.npmUtil = npmUtil || new NpmUtil(this.logger);

        this.config = {
            add: {
                title: `templates`,
                description: `Select the active templates for the new project.`,
                default: '',
                choices: [OPTION_HANA, OPTION_JAVA, OPTION_MTA, OPTION_PIPELINE],
                multiple: true,
                promptOrder: 10
            },
            force: {
                default: false
            },
            verbose: {
                default: false
            }
        }
    }

    /**
     * @param {string} templates, comma separated list of templates, no blanks
     * @param {any} options, additional options
     */
    async addCmd(templates, options = {}) {
        options.add = templates;

        this._initialize(null, options);
        options._cmd = 'add';
        this._greetings(options._cmd);

        const folderContent = await this.fsUtil.readdir(this.projectPath);
        if (!folderContent.includes('package.json')) {
            throw new Error(`The current folder doesn't seem to contain a project (package.json is missing).`);
        }

        if (options.add.has(OPTION_JAVA)) {
            throw new Error('Cannot change the type of an existing project.');
        }

        await this._process(options);
        await this.stepEnd(options);
    }

    /**
     * @param {string} projectName, the project name
     * @param {any} options, additional options
     */
    async initCmd(projectName, options = {}) {
        await this.stepInit(projectName, options);
        await this.stepEnd();
    }

    async stepInit(projectName, options = {}) {
        options.add = (options.add || '') + ',project';

        this._initialize(projectName, options);
        options._cmd = 'init';
        this._greetings(options._cmd);

        await this._process();
    }

    _initialize(projectName, options = {}) {
        const workingFolder = options.cwd || process.cwd();
        this.projectPath = path.resolve(workingFolder, projectName || '.');

        this.options = options;
        this._cleanupOptions();
    }

    _greetings(cmd) {
        switch (cmd) {
            case 'init': {
                const relativeProjectPath = path.relative(process.cwd(), this.projectPath);
                const folderName = (relativeProjectPath ? `.${path.sep}${relativeProjectPath}` : 'current folder');
                this.logger.log(`[cds] - creating new project in ${folderName}`);
                break;
            }

            case 'add':
                this.logger.log(`[cds] - adding template(s) to project in current folder`);
                break;

            default:
        }

        if (this.options.force) {
            this.logger.log(`Using '--force' ... existing files will be overwritten...!`);
        }
    }

    async _process() {
        if (DEBUG) {
            this.logger.debug(`Project path: ${this.projectPath}`);
        }

        await this._fillTemplateList();

        for (const template of this.templateList) {
            await template.run();
        }

        this.logger.log(`done.`);
        this.logger.log();
    }

    async _fillTemplateList() {
        this.templateList = [];

        for (const addOption of this.options.add) {
            if (addOption !== OPTION_JAVA) {
                let Template;
                try {
                    Template = require(`./template/${addOption}`);
                } catch (err) {
                    throw new Error(`template '${addOption}' not found.`);
                }
                const template = new Template(this.projectPath, this);
                this.templateList.push(template);
            }
        }

        this.templateList.sort((a, b) => {
            const prioA = a.getPriority();
            const prioB = b.getPriority();
            return prioB - prioA;
        });

        const newList = [];
        for (const template of this.templateList) {
            // checkEnabled might throw error if call is invalid to abort execution
            this.logger.debug(`Checking template '${template.name}'`);
            if (await template.checkEnabled()) {
                this.logger.debug(`Adding template '${template.name}'`);
                newList.push(template);
            }
        }
        this.templateList = newList;

        if (DEBUG) {
            this.logger.debug(`Templates: ${this.templateList.map((obj) => {
                return obj.name;
            }).join(', ')}`);
        }
    }

    async stepEnd() {
        for (const template of this.templateList) {
            await template.finalize();
        }

        if (this.options.verbose) {
            this._showFiles();
        }
    }

    _showFiles() {
        const files = this.fsUtil.getTouchedFiles();
        if (files && files.length > 0) {
            this.logger.log();
            this.logger.log(`Added / changed files`);
            for (const file of files) {
                this.logger.log(`- ${file}`);
            }
        }
    }

    _cleanupOptions() {
        let tokens = [];

        if (typeof this.options.add === 'string') {
            tokens = this.options.add.split(',');

        } else if (Array.isArray(this.options.add)) {
            tokens = this.options.add

        } else if (this.options.add instanceof Set) {
            tokens = [...this.options.add];
        }

        const trimmedTokens = tokens.map((token) => {
            return token.trim();
        }).filter((token) => {
            return !!token;
        });

        // set is ordered ... always
        this.options.add = new Set(trimmedTokens);
    }

    // _loadLib: async (libName, cwd = process.cwd()) => {
    //     const searchPaths = await this._npmModulePaths(cwd)
    //     const libPath = require.resolve(libName, { paths: searchPaths });
    //     return require(libPath);
    // },

    // _npmModulePaths: async (cwd) => {
    //     const globalNodeModules = await this._getNpmRoot();
    //     return [cwd, globalNodeModules];
    // },

    // _getNpmRoot: async () => {
    //     if (!this.npmRoot) {
    //         // const npmRootCall = await CommandUtil.executeCommand('npm', ['root', '-g'], null, nullLogger);
    //         // this.npmRoot = npmRootCall.stdout.toString().trim();
    //     }
    //     return this.npmRoot;
    // }
}
