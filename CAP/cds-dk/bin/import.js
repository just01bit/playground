module.exports = Object.assign ( _import, { _name:'import',
    options: ['--out'],
    flags:[ '--dry', '--no-copy', '--no-save' ],
    shortcuts: ['-o','-'],
    help: `
# SYNOPSIS

    *cds import* <source> [<options>]

    Imports the given source and converts it to CSN.
    Currently only OData EDMX input is supported.

    Without any options the source is copied to ./src/external and the csn
    output written next to it. Finally it will add an entry for the imported
    service to package.json#cds.requires.


# OPTIONS

    *--no-copy*
        Skips copying to ./srv/external.

    *--no-save*
        Skips updating ./package.json.

    *-o | --out* <filename>
        Skips copying to ./srv/external and writes to the specified location.

    *- | --dry*
        Writes the converted csn to stdout only.


# EXAMPLES

    cds import ~/Downloads/API_BUSINESS_PARNTER.edmx
    cds import - ~/Downloads/API_BUSINESS_PARNTER.edmx

`})

// const edm2csn = require('@sap/edm-converters/lib/edmToCsn/lib/main')
const cds = require ('@sap/cds')
const fs = cds.utils, {path} = fs

async function _import (file, { out, dry, 'no-save':no_save, 'no-copy':no_copy }={}) {
    if (Array.isArray(file)) file = file[0]
    if (file) file = path.resolve(file); else return this.help ('import')
    if (!dry && !no_copy) file = await _copy_to_srv_external (file)
    const src = await _read (file)
    const csn = await _edmx2csn (src)
    const written = dry || _write (csn, out = out || file.replace(/\.[^.]+$/,'.csn'))
    const registered = dry || no_save || _update_package_json (out, csn)
    if (dry)  return console.log (JSON.stringify(csn,0,'  '))
    return Promise.all ([ written, registered ])
}


async function _read (file) {
    if (!file && !process.stdin.isTTY) return new Promise ((_resolved, _error) => {
        let src=""; process.stdin
        .on ('data', chunk => src += chunk)
        .on ('end', ()=> _resolved (src))
        .on ('error', _error)
    })
    else return await fs.readFileSync (file, 'utf-8')
}


async function _write (csn, dest) {
    await fs.writeFileSync (dest, JSON.stringify(csn,null,'  '))
    const service = _service_name_from(csn)
    console.log(
`[cds] - imported API to ${path.relative(process.cwd(),dest)}
> use it in your CDS models through the like of:

using { ${service} as external } from './${path.relative('srv',dest) .replace (/\\/g,'/')}';
    `)
}


async function _edmx2csn (edmx) {
    const edm2csn = require ('@sap/edm-converters/lib/edmToCsn/lib/main')
    const TwoSchemas = /(\s*<\/Schema>\s*<Schema [^>]*>)\s*/m
    if (TwoSchemas.test(edmx)) {
        /*
            This is a quick hack only handling the following case we saw from SFSF:

            <edmx:DataServices>
                <Schema Namespace="SFODataSet">
                    <EntityContainer>
                        <EntitySet Name="Foos" EntityType="SFOData.Foo"> ... </EntitySet>
                    </EntityContainer>
                </Schema>
                <Schema Namespace="SFOData">
                    <EntityType Name="Foo"> ... </EntityType>
                </Schema>
            </edmx:DataServices>

            which is turned into that:

            <edmx:DataServices>
                <Schema Namespace="SFOData">
                    <EntityContainer>
                        <EntitySet Name="Foos" EntityType="SFOData.Foo"> ... </EntitySet>
                    </EntityContainer>
                    <EntityType Name="Foo"> ... </EntityType>
                </Schema>
            </edmx:DataServices>
        */
        const [,namespace] = edmx.match (/EntityType="([^.]+)/)
        edmx = edmx .replace (TwoSchemas,'') .replace (/<Schema Namespace="[^"]+"/, `<Schema Namespace="${namespace}"`)
    }
    const csn = JSON.parse (await edm2csn.generateCSN (edmx, false, true))
    return csn
}


async function _copy_to_srv_external (file) {
    const cwd = process.cwd(), external = path.join (cwd,'srv','external')
    if (!file.startsWith(external+path.sep)) {
        await fs.mkdirp (external)
        const copy_or_move = file.startsWith(cwd+path.sep) ? fs.renameSync : fs.copyFileSync
        const src = file, dst = file = path.join (external, path.basename(file))
        copy_or_move (src,dst)
    }
    return file
}


function _service_name_from (csn) {
    for (let each in csn.definitions) {
        if (csn.definitions[each].kind === 'service')  return each
    }
}

function _update_package_json (dest, csn) {
    try {
        const package_json = path.resolve ('package.json')
        const conf = fs.existsSync(package_json) ? require (package_json) : {}
        const service = _service_name_from(csn)
        const requires = ['cds','requires'] .reduce ((p,n)=>p[n] || (p[n]={}), conf)
        if (!requires[service]) {
            const model = path.relative(process.cwd(), dest.replace(/\.csn$/,''))
            cds.env.requires[service] = requires[service] = { kind:'odata', model }
            fs.writeFileSync (package_json, JSON.stringify(conf,null,'  '))
            console.log (`[cds] - updated ./package.json`)
        }
    } catch(e){/* ignore */}
}
