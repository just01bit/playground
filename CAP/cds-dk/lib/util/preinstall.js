const path = require('path')
const fs = require('fs')

const term = require('./term');

/**
 * Check whether an installation of `@sap/cds-dk` is attempted
 * next to an existing installation of `@sap/cds`
 */
const check = function () {
    const cds = path.resolve(__dirname, '../../../cds')
    if (fs.existsSync(cds)) {
        throw new Error(`
The command 'cds' has moved from library @sap/cds to @sap/cds-dk.
It is recommended to remove the global version of @sap/cds and
reinstall @sap/cds-dk via
    npm rm -g @sap/cds
    npm i -g @sap/cds-dk
`)
    }
}

// do check if invoked directly from command line or npm
if (!module.parent) {
    try { // when called from npm, only do the check if called with `npm -g`
        const npm = JSON.parse(process.env.npm_config_argv || '{}').cooked
        if (!npm || npm.includes('--global')) check()
    } catch (e) {
        console.log(term.warn(e.message));
        process.exit(1)
    }
} else {
    // otherwise export for programmatic use, e.g. from tests
    module.exports = check
}
