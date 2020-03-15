module.exports = Object.assign ( watch, {
    flags: [ '--debug' ],
    help: `
# SYNOPSIS

    *cds watch* [<project>]

    Tells cds to watch for relevant things to come or change in the specified
    project or the current work directory and compile and (re-)run the server
    on every change detected, using the open-source package _nodemon_.

# OPTIONS

    - see _cds help serve_

# SEE ALSO

    Actually, *cds watch* is just a convenient shortcut for:
    *cds serve* --with-mocks --in-memory? --watch [--project <project>] ...
    Check out *cds serve ?* to learn more.

`})

const path = require ('path')
const t = module.exports.codes = {
    reset: '\x1b[0m', // Default
    bold: '\x1b[1m', // Bold/Bright
    link: '\x1b[4m', // underline
    red: '\x1b[91m', // Bright Foreground Red
    green: '\x1b[32m', // Foreground Green
    yellow: '\x1b[33m', // Foreground Green
    orange: '\x1b[38;2;255;140;0m' // darker orange, works with bright and dark background
}


const log = (first,...more) => console.log (t.yellow + (first||''), ...more, t.reset)

function watch ([folder],{ext='cds,csn,csv,ts,mjs,cjs,js,json,properties,edmx,xml'}={}) {
    if (folder) process.chdir (folder)
    log ()
    log (`${t.bold}[cds] - running nodemon...`)
    log (`--exec cds serve --with-mocks --in-memory?`)
    log (`--ext ${ext}`)
    let delayed = undefined
    const nodemon = require ('nodemon')
    return nodemon ({
        ext, script:__filename, env:{
            _cds_home: global.cds.home,
            NODE_PATH: path.resolve (__dirname, '../node_modules') // allow global sqlite to be resolved
        }
    }).on('restart', (files)=>{
        clearTimeout (delayed)
        delayed = setTimeout(()=>{
            log (`${t.bold}        _______________________\n`)
            if (files) for (let each of files) {
                const [,ext] = /\.(\w+)$/.exec(each) || []
                for (let handle of FileHandlers [ext] || [])  handle (each)
            }
        }, 111)}
    ).on('quit', ()=>{
        log (`${t.bold+t.green}\n[cds] - my watch has ended.\n`)
        process.exit()
    })
}


const FileHandlers = {
    edmx: [ file => (FileHandlers._import || (FileHandlers._import = require ('./import'))) (file) ]
}

if (!module.parent) { // launched by nodemon
    // fail early if there are no models at the usual places...
    const cds = require (process.env._cds_home || '@sap/cds') //> uses local cds
    const all = !cds.env.deploy._compat ? cds.env.deploy.models : cds.resolve ('*',false)
    if (!cds.resolve(all)) return nothingFoundAt (all)
    // run through cli --> that's in order to use it's error handling
    const cli = require('./cds');  cds.watch = true
    return cli ('serve', 'all', '--with-mocks', '--in-memory?')
}

function nothingFoundAt (all) { return console.error (`
    No models found at ${all}.
    Waiting for some to arrive...
`)}
