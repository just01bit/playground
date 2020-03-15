const path = require('path')
const handlebars = require('handlebars')
const cds = require('@sap/cds')
const { nullLogger } = require('../../util/logger')
const TemplateBase = require('../templateBase');
const BuildTaskFactory = require('@sap/cds/lib/build/buildTaskFactory')
const { BUILD_TASK_HANA, BUILD_TASK_FIORI, BUILD_TASK_JAVA, BUILD_TASK_NODE, BUILD_TASK_MTX } = require("@sap/cds/lib/build/constants")

const DEBUG = process.env.DEBUG
const TEMPLATE_PATH_MTA = path.join(__dirname, 'files/mta.yaml.hbs')

const P_LANGUAGE_JAVA = 'java'
const P_LANGUAGE_NODEJS = 'nodejs'
const DEFAULT_P_LANGUAGE = P_LANGUAGE_NODEJS

const { OPTION_MTA } = require('../../constants');

module.exports = class MtaTemplate extends TemplateBase {
    constructor(projectPath, generator) {
        super(projectPath, generator, __dirname);

        MtaTemplate.initializeHandlebars()
    }

    getPriority() {
        return -Number.MAX_VALUE;
    }

    async checkEnabled() {
        if (!this.options.add.has(OPTION_MTA)) {
            return false;
        }

        if (this.options.force) {
            return true;
        }

        if (await this.fsUtil.pathExists(path.join(this.projectPath, 'mta.yaml'))) {
            throw new Error(`File mta.yaml already exists in current folder. Use --force to overwrite.`);
        }

        return true;
    }

    async run() {
        super.run();

        if (!this._hasHanaServiceBinding()) {
            this.logger.warn(`No hana service binding defined in the requires section of the project's package.json. Database module omitted in mta.yaml`) //NOSONAR
        }

        if (DEBUG) {
            this.logger.log(JSON.stringify(this.env, null, 1))
        }
        const context = await this.createContext()
        if (DEBUG) {
            this.logger.log(JSON.stringify(context, null, 1))
        }
        const mta = await this.processTemplate(context)
        await this.fsUtil.writeFile(path.join(this.projectPath, "mta.yaml"), mta)
    }

    get cds() {
        if (!this._cds) {
            // re-initialize cds env as the projectPath does not exist at the point in time this template is constructed
            this._cds = cds.in(this.projectPath)
        }
        return this._cds
    }

    get env() {
        return this.cds.env
    }

    async createContext() {
        const appContext = {};
        const appDetails = await this._getAppDetails()
        const capContext = {
            appId: appDetails.appId,
            appName: appDetails.appName,
            appVersion: appDetails.appVersion,
            appDescription: appDetails.appDescription,
            pLanguage: DEFAULT_P_LANGUAGE,
            srvPath: null,
            appPath: null,
            db: [],
            requires: [],
            get multiTenant() {
                return this.requires.reduce((a, req) => {
                    return a || req.resource.multiTenant;
                }, false)
            }
        }

        const buildTasks = await new BuildTaskFactory(DEBUG ? this.logger : nullLogger, this.cds).getTasks({ root: this.projectPath, resolve: true, mta: false })

        buildTasks.forEach((task) => {
            const relDestPath = MtaTemplate._slash(path.relative(this.projectPath, task.dest))

            switch (task.for) {
                case BUILD_TASK_HANA:
                    // check whether we have a hana service binding defined as a hana build task is returned by default for compatibility reasons if neither hana, nor sqlite has been defined
                    if (this._hasHanaServiceBinding()) {
                        capContext.db.push({ dbPath: relDestPath })
                    }
                    break

                case BUILD_TASK_JAVA:
                    capContext.pLanguage = P_LANGUAGE_JAVA
                    capContext.srvPath = relDestPath
                    break

                case BUILD_TASK_NODE:
                    capContext.srvPath = relDestPath
                    break

                case BUILD_TASK_FIORI:
                    capContext.appPath = MtaTemplate._slash(path.relative(this.projectPath, task.src).split(path.sep)[0])
                    break

                case BUILD_TASK_MTX:
                    break

                default:
                    throw new Error(`Unknown build task type ${task.for}`)
            }
        })

        this._addResourceDependencies(capContext)

        return { cap: capContext, app: appContext }
    }

    async processTemplate(context) {
        return this.templateUtil._processTemplateFile(TEMPLATE_PATH_MTA, context)
    }

    async _addResourceDependencies(capContext) {
        const hanaResources = new Map()
        const otherResources = new Map()

        for (let key of Object.keys(this.env.requires)) {
            if (this.env.requires[key].kind === 'hana') {
                hanaResources.set(key, this.env.requires[key])
            } else {
                otherResources.set(key, this.env.requires[key])
            }
        }
        for (let [key, value] of hanaResources) {
            let resource = this._getReqResource(key, value, capContext)
            if (resource) {
                // using production profile
                capContext.requires.push({ resource })
            }
        }
        // add after hana resource dependencies have been handled as multitenant information is required
        for (let [key, value] of otherResources) {
            let resource = this._getReqResource(key, value, capContext)
            if (resource) {
                // using production profile
                capContext.requires.push({ resource })
            }
        }
    }

    _hasHanaServiceBinding() {
        return MtaTemplate._getProperty(this.env, 'requires.db.kind') === 'hana'
    }

    static _slash(filename) {
        return filename ? filename.replace(/\\/g, '/') : filename
    }

    _getReqResource(key, reqEntry, capContext) {
        const resource = {
            name: MtaTemplate._getResourceName(key, capContext),
            service: '',
            multiTenant: reqEntry.multiTenant || false,
            vcap: reqEntry.vcap || {}
        }

        switch (reqEntry.kind) {
            case 'hana':
                // use different service name to avoid conflicts when switching from single tenant to multitenant
                // otherwise we would enforce that users have to delete the db container first
                if (resource.multiTenant) {
                    resource.name += '-mt'
                }
                resource.service = resource.multiTenant ? 'managed-hana' : 'hana'
                resource.vcap.plan = 'hdi-shared'
                break

            case 'xsuaa':
                if (capContext.multiTenant) {
                    resource.name += '-mt'
                }
                resource.service = reqEntry.kind
                resource.vcap.plan = 'application'
                break

            default: {
                if (MtaTemplate._getProperty(reqEntry, 'vcap.plan')) {
                    resource.service = reqEntry.kind
                } else if (DEBUG) {
                    this.logger.log(`Skip resource ${key}`)
                }
            }
        }
        return resource.service ? resource : null
    }

    static _getResourceName(key, capContext) {
        let name = key
        // only if not already present
        if (!name.includes(capContext.appName)) {
            name = capContext.appName + '-' + name
        }
        return name
    }

    async _getAppDetails() {
        const packageJson = await this.fsUtil.readJSON(path.join(this.projectPath, 'package.json'))

        let segments = packageJson.name ? packageJson.name.trim().split('/') : [path.basename(this.projectPath)]
        // scope as namespace
        if (segments[0].startsWith('@')) {
            segments[0] = segments[0].replace('@', '')
        }
        segments = segments.map(segment => segment.startsWith('@') ? encodeURIComponent(segment.replace('@', '')) : encodeURIComponent(segment))

        return {
            appName: segments[segments.length - 1],
            appId: segments.join('.'),
            appVersion: packageJson.version || '1.0.0',
            appDescription: packageJson.description || segments[segments.length - 1]
        }
    }

    static _getProperty(src, segments) {
        segments = Array.isArray(segments) ? segments : segments.split('.')
        return segments.reduce((p, n) => p && p[n], src)
    }

    static initializeHandlebars() {
        if (!MtaTemplate.handlebarsInitialized) {
            handlebars.registerHelper({
                eq: function (v1, v2) {
                    return v1 === v2;
                },
                ne: function (v1, v2) {
                    return v1 !== v2;
                },
                lt: function (v1, v2) {
                    return v1 < v2;
                },
                gt: function (v1, v2) {
                    return v1 > v2;
                },
                lte: function (v1, v2) {
                    return v1 <= v2;
                },
                gte: function (v1, v2) {
                    return v1 >= v2;
                },
                and: function () {
                    return Array.prototype.slice.call(arguments).every(Boolean);
                },
                or: function () {
                    return Array.prototype.slice.call(arguments, 0, -1).some(Boolean);
                }
            })
            MtaTemplate.handlebarsInitialized = true;
        }
    }
}
