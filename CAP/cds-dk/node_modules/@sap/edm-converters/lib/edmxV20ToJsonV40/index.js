'use strict';

/**
 * API documentation of OData Edmx V2 to Json V4 converter. For normal documentation please see
 * see README.md in /lib/edmxV20toJsonV40
 * @module EdmxV20ToJsonV40
 */

const fs = require('fs');
const path = require('path');
const utils = require('../common/lib/utils');

const Constants = require('../constants');
const InfoLogger = require('../common/lib/Logger');
const MetadataConverterV2 = require('./lib/MetadataConverterV2');

const version = '0.1';
const commandName = 'edmxV20ToJsonV40';
module.exports.version = version;


/**
 * Performs the conversion
 * @param {Object} options
 * @param {string} options.inputFile XML file containing the EDM (use absolute or relative path)
 * @param {string} options.output File for JSON output (if omitted output is written to stdout and the default log level is "Error")
 * @param {string} options.inputdir Directory containing the input file (used if input file name is relative)
 * @param {string} options.outputdir Directory containing the output files (used if output to file is used and output file name is relative)
 * @param {Array}  options.map Referenced namespace to file mapping (e.g. ... [ns1=fn1,ns2=fn2,ns3=ns3])
 * @param {string} [options.log=["i"|"d"|"e"]] Show log information (use i for info(is default), d for debug and e for error)
 * @param {string} [options.functionPrefix='Gen'] Function name prefix for generated functions
 * @param {ConverterCallback} [cb] Function to be called if the converter is finished
 * @returns {undefined}
 */
module.exports.convertFile = (options, cb) => {
    let logLevel = InfoLogger.OPTION_MAP[options.loglevel];
    if (logLevel === undefined) { logLevel = InfoLogger.INFO; }

    const logger = new InfoLogger(logLevel);

    const references = options.map ? new Map(options.map.map(e => e.split('='))) : new Map();

    // input
    if (!options.input) {
        return utils.exitOrCallback(logger, `Please provide input file, use '${Constants.CONV_NAME} ${commandName}` +
            " --help' for more information", cb);
    }
    const inputDir = options.inputdir ? path.resolve('.', options.inputdir) : '.';
    const inputFileAbs = path.resolve(inputDir, options.input);

    // output
    const outputdir = options.outputdir ? path.resolve('.', options.outputdir) : '.';
    let outputFileAbs;
    if (!options.output) {
        outputFileAbs = null;
        if (!options.log) { logger.setLogLevel(InfoLogger.ERROR); }
        // for output to stdout the default level is error, so that the stdout is not polluted
    } else {
        outputFileAbs = path.resolve(outputdir, options.output);
    }

    // load source file
    let inputFileContent;
    try {
        logger.info(`Read source file '${inputFileAbs}'...`);
        inputFileContent = fs.readFileSync(inputFileAbs);
    } catch (error) {
        return utils.exitOrCallback(logger, `Input file ${inputFileAbs} not found!`, cb);
    }

    // load reference namespace on demand
    const referencedFileLoader = (namespace, uri, lCb) => {

        logger.info(`Read namespace '${namespace}'`);
        const file = references.get(namespace);
        if (!file) {
            return lCb(null, null); // error loading referenced namespaces are collected
        }
        const fileAbs = path.resolve(inputDir, file);

        logger.info(`Read namespace '${namespace}' ('${file}') ...`);
        try {
            const xml = fs.readFileSync(fileAbs);
            return lCb(null, xml);
        } catch (error) {
            return utils.exitOrCallback(logger, `File ${file} not found!`, cb);
        }
    };

    // options
    const converterOptions = {
        xmlProvider: referencedFileLoader,
        logger: logger,
        functionPrefix: options.functionPrefix
    };

    // convert
    logger.info(`Start converting file '${inputFileAbs}'...`);
    const converter = new MetadataConverterV2(converterOptions);
    converter.execute(inputFileContent, (error, result, missingNamespaces) => {
        if (error) {
            if (missingNamespaces) {
                // log all missing namespaces at once
                for (const item of missingNamespaces) {
                    logger.error('MISSING: ' + item.namespace + ' ' + (item.uri ? item.uri : ''));
                }
            }
            return utils.exitOrCallback(logger, error.message, cb, missingNamespaces);
        }

        // write target
        logger.info(`Writing '${outputFileAbs || 'to stdout'}'...`);
        try {
            if (outputFileAbs) {
                fs.writeFileSync(outputFileAbs, JSON.stringify(result, null, 1));
                logger.info('Finished'); // write finished information only if out put is not written to stdout
            } else {
                console.log(JSON.stringify(result, null, 1)); // eslint-disable-line no-console
            }
        } catch (writeError) {
            return utils.exitOrCallback(logger, `Output file could not be written to '${outputFileAbs}`, cb);
        }

        utils.exitOrCallback(logger, undefined, cb);
        return undefined;
    });
    return undefined;
};


/**
 * @callback
 */


/**
 * Converts a OData V2 EDM model (XML Format) to OData V4 EDM (JSON Format)
 * @param {Object} options Object describing what should be converted (@see _convertFile)
 * for more information.
 */
const _convertFile = (options) => {
    module.exports.convertFile(options);
};

/**
 * Attaches a command to an instance of the commander node module
 * @param {Object} commander Instance of the commander node module
 * @returns {void}
 */
module.exports.attachCommand = (commander) => {
    commander.command(commandName)
        .description(
            'Converts a OData V2 EDMX metadata xml file to an OData V4 CSDL JSON file')
        .option('-i, --input <filename>',
            'XML file containing the EDM (use absolute or relative path)')
        .option('-o, --output [filename]',
            'File for JSON output (if omitted output is written to ' +
            'stdout with log level "Error" if log level is not set explicitly)')
        .option('--inputdir [path]',
            'Directory containing the input file (used if input file name is relative)')
        .option('--outputdir [path]',
            'Directory containing the output files (used if output to file is used and output file name is relative)')
        .option('-m, --map [namespacemapping]',
            'Referenced namespace to file mapping (e.g. "... -m ns1=fn1,ns2=fn2 -m ns3=ns3")', utils.collect, [])
        .option('-l, --loglevel [i,d,e]',
            'Show log information (use "i"/"info" for info(default), "d"/"debug" for debug and "e"/"error" for error)')
        .option('-p, --functionPrefix <functionPrefix>',
            'Function name prefix for generated functions')
        .on('--help', () => {
            console.log('Examples:'); // eslint-disable-line no-console
            // eslint-disable-next-line no-console
            console.log(`${Constants.CONV_NAME} edmxV20ToJsonV40 -i edm.xml -o edm.json `
                + '-m namespace.A=A.xml,namespace.B=B.xml -l info -p gen');
        })
        .action(_convertFile);
};
