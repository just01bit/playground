#!/usr/bin/env node
'use strict';

// commander has quite a few issues, but hdi also uses commander...,
// TODO: check subcommander instead, NPM uses nopt
// There is also node-getopt, posix-getopt, getopt-c, option-parser, ...
// Discussion: https://github.com/pegjs/pegjs/issues/429
const program = require('commander');
const compiler = require('../lib/main');
let overwriteFile = false;
let ignorePersistenceSkip = false;
let mockserver = false;

program
    .version(compiler.version())
    .usage('[options]')
    .option('-i, --edmx-input', 'specifies the location and name of the OData model (file path or URL) to be converted')
    .option('-o, --csn-output', 'specifies the file path where the converted CSN file is to be placed')
    .option('-f, --csn-overwrite', 'overwrites the output file if it already exists')
    .option('-p, --ignore-persistence-skip',
        'ignores @cds.persistence.skip annotation specified on any entity in the model')
    .option('-m, --mockserver', 'ensures that the CSN entity name is derived from the entity set name instead of the entity type name in the EDMX');
program.parse(process.argv);

// the following should have been done by commander:
if (!program.args.length) { program.help(); }               // well, also some kind of error

let edmx = '';

if (!compiler.isValidInputFile(program.edmxInput, program.args[0])) {
    // Input option is not specified Or file/URL is not specified
    compiler.displayErrors(compiler.getErrorList());
    process.exit(1);
}

if (!compiler.isValidOutputFile(program.csnOutput, program.args[1])) {
    // Either output file is not specified Or file extension is invalid
    compiler.displayErrors(compiler.getErrorList());
    process.exit(1);
}

if (program.csnOverwrite) {
    // Overwrite the output file. By default new file version is generated.
    overwriteFile = true;
}

if (program.ignorePersistenceSkip) {
    // Ignores @cds.persistence.skip:true in the output csn file based on this option.
    // By default @cds.persistence.skip:true is added for all entities in CSN.
    ignorePersistenceSkip = true;
}

if (program.mockserver) {
    // Pick EntityType name as Service Model Name in CSN Instead of Entityset name if Entityset name does not match with EntityType
    // By default Entityset name is Service Model Name in CSN.
    mockserver = true;
}

function postActions(csnData, error) {
    // Errors during CSN generation or Saving to file location
    if(error){
        console.log(error);
    }
    let errors = compiler.getErrorList();
    if ((csnData === undefined || csnData === null) && errors) {
        compiler.displayErrors(errors);
        process.exit(1);
    }
}

// First try to load input path from file system.
edmx = compiler.getMetadataFromFile(program.args[0]);
if (edmx) {
    compiler.generateCSN(edmx, ignorePersistenceSkip, mockserver).then(csnData => {
        if (program.csnOutput && csnData !== undefined && csnData !== null) {
            compiler.saveCSNModel(csnData, program.args[1], overwriteFile);
            postActions(csnData);
        }
    }).catch((error) => {
        postActions(null, error);
    });
} else {
    // Second try as an URL.
    let validUrl = program.args[0];
    if (validUrl.indexOf('$metadata') < 0) {
        validUrl = validUrl + '$metadata';
    }
    compiler.getMetadataFromURL(validUrl).then(edmx => {
        if (edmx) {
            // is it okay
            compiler.generateCSN(edmx, ignorePersistenceSkip, mockServerUc).then(csnData => {
                if (program.csnOutput && csnData !== undefined && csnData !== null) {
                    compiler.saveCSNModel(csnData, program.args[1], overwriteFile);
                    postActions(csnData);
                }
            }).catch((error) => {
                postActions(null, error);
            });
        }
    }).catch(() => {
        postActions(null);
    });
}
