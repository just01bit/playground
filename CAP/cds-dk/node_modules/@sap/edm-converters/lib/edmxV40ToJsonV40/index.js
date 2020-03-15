'use strict';

/**
 * API documentation of OData Edmx V4 to Json V4 converter. For normal documentation please see
 * see README.md in /lib/edmxV40toJsonV40
 * @module EdmxV40ToJsonV40
 */

const fs = require('fs');
const path = require('path');
const utils = require('../common/lib/utils');

const Constants = require('../constants');
const InfoLogger = require('../common/lib/Logger');
const MetadataConverterFactory = require('../common/lib/MetadataConverterFactory');

const version = '0.1';
const commandName = 'edmxV40ToJsonV40';
module.exports.version = version;


/**
 * Performs the conversion
 * @param {Object}  options
 * @param {string} options.inputFile XML file containing the EDM (use absolute or relative path)
 * @param {string} options.output File for JSON output (if omitted output is written to stdout and the default log level is "Error")
 * @param {string} options.inputdir Directory containing the input file (used if input file name is relative)
 * @param {string} options.outputdir Directory containing the output files (used if output to file is used and output file name is relative)
 * @param {string} [options.target=["okralib"]] The target output format like for okralib or oasis csdl spec
 * @param {Array}  options.map Referenced namespace to file mapping (e.g. ... [ns1=fn1,ns2=fn2,ns3=ns3])
 * @param {string} [options.log=["i"|"d"|"e"]] Show log information (use i for info(is default), d for debug and e for error)
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
        inputFileContent = fs.readFileSync(inputFileAbs).toString();
    } catch (error) {
        if (options.stacktrace) {
            logger.error(`Input file ${inputFileAbs} not found!`);
            logger.error(error.stack);
        }
        return utils.exitOrCallback(logger, `Input file ${inputFileAbs} not found!`, cb);
    }

    logger.info(`Start convert source '${inputFileAbs}'...`);

    const converterOptions = {
        metadataFactory: (namespace, uri, callback) => {
            try {
                let resultRefFile = null;

                for (const [key, value] of references) {
                    if (namespace.startsWith(key)) {
                        resultRefFile = value;
                    }
                }

                if (resultRefFile == null) {
                    return callback();
                }

                logger.info(`Reading referenced source '${resultRefFile}' for missing type '${namespace}'...`);

                try {
                    const fileAbs = path.resolve(inputDir, resultRefFile);
                    const refFileContent = fs.readFileSync(fileAbs).toString();
                    logger.info(`Read namespace '${namespace}' ('${fileAbs}') ...`);
                    return callback(null, refFileContent);
                } catch (error) {
                    if (options.stacktrace) logger.error(error.stacktrace);
                    return utils.exitOrCallback(logger, `File ${resultRefFile} not found!`, cb);
                }
            } catch (error) {
                if (options.stacktrace) logger.error(error.stacktrace);
                return utils.exitOrCallback(logger, error.message, cb);
            }
        }
    };

    if (options.target !== undefined) {
        if (options.target.toLowerCase() === MetadataConverterFactory.TARGETS.LIBRARY.toLowerCase()) {
            converterOptions.target = MetadataConverterFactory.TARGETS.LIBRARY;
        }
    }

    MetadataConverterFactory
        .create(undefined, converterOptions)
        .execute(inputFileContent, (error, result, missingNamespaces) => {
            if (error) {
                if (options.stacktrace) logger.info(error.stacktrace);
                if (missingNamespaces) {
                    // log all missing namespaces at once
                    for (const item of missingNamespaces) {
                        logger.error('MISSING: ' + item.namespace + ' ' + (item.uri ? item.uri : ''));
                    }
                }
                return utils.exitOrCallback(logger, error.message, cb, missingNamespaces);
            }

            logger.info(`Writing '${outputFileAbs || 'to stdout'}'...`);
            try {
                if (outputFileAbs) {
                    fs.writeFileSync(outputFileAbs, JSON.stringify(result, null, 1));
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
            'Converts a OData V4 EDMX metadata xml file to an OData V4 CSDL JSON file')
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
        .option('-t, --target [target]',
            'Creates json output for a specific target. Default is Oasis CSDL 4.01-CS02 format.' +
            'To create the Oasis CSDL 4.01-CS01 format, use "cs01" as target'
        )
        .option('-s, --stacktrace', 'In case of an error the stacktrace is written to STDOUT')
        .on('--help', () => {
            console.log('  Examples:'); // eslint-disable-line no-console
            // eslint-disable-next-line no-console
            console.log(`${Constants.CONV_NAME} edmxV40ToJsonV40 -i edm.xml -o edm.json `
                + '-m namespace.A=A.xml,namespace.B=B.xml -l info');
        })
        .action(_convertFile);
};
