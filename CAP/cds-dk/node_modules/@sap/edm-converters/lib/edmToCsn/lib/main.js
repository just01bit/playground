// Command to invoke from: C:\D\edmx2csn\core\bin>
// a) edmx2csn -i ../../input/metadata.xml -o ../../output/
// b) node edmx2csn.js -i ../../input/metadata.xml -o ../../output/

'use strict';
let convert = require('xml-js');
let request = require('request');
let fs = require('fs');
let edmxv2CSN = require('./odatav2/v2parser');
let edmxv4CSN = require('./odatav4/v4parser');
let getMessages = require('./common/message');
let common = require('./common/common');
let versionInfo = require('../../../package.json').version;
let errors = [];
let defaultFileName;

function getV2Messages() {
    return getMessages();
}

function version() {
    return versionInfo;
}

function getErrorList() {
    return errors;
}

function _flushErrors() {
    // Flush errors if any
    errors.length = 0;
}

function _isDirectory(fileLoc) {
    try {
        if (fs.statSync(fileLoc).isDirectory()) {
            return true;
        }
    } catch (error) {
        return false;
    }
    return false;
}

function _isValidXML(text) {
    let isValid = false;
    let cjson;
    try {
        cjson = convert.xml2json(text, {
            compact: true,
            spaces: 4
        });
        JSON.parse(cjson);
        isValid = true;
    } catch (err) {
        isValid = false;
    }
    return isValid;
}

function isValidInputFile(isInputSpecified, inputFileLoc) {
    let isValid = true;
    _flushErrors();

    if (!isInputSpecified) {
        // Input option not specified
        errors.push(getV2Messages().SPECIFY_INPUT_FILE);
        isValid = false;
    } else if (inputFileLoc === undefined || inputFileLoc == null || inputFileLoc.trim() === '') {
        // Input file/metadata URL not specified
        errors.push(getV2Messages().SPECIFY_INPUT_FILE);
        isValid = false;
    }
    return isValid;
}

function isValidOutputFile(isOutputSpecified, outputFileLoc) {
    let isValid = true;
    let index;
    let extension;
    _flushErrors();
    if (!isOutputSpecified) {
        // Output option not specified
        errors.push(getV2Messages().SPECIFY_OUTPUT_FILE);
        isValid = false;
    } else if (outputFileLoc === undefined || outputFileLoc == null || outputFileLoc.trim() === '') {
        // Output file not specified
        errors.push(getV2Messages().SPECIFY_OUTPUT_FILE);
        isValid = false;
    } else {
        index = outputFileLoc.lastIndexOf('.');
        if (outputFileLoc !== './' && outputFileLoc !== '.\\' && index > 0) {
            extension = outputFileLoc.substring(index + 1);
            if (extension && extension !== 'json') {
                // Invalid extension specified
                errors.push(getV2Messages().INVALID_OUTPUT_FILE);
                isValid = false;
            }
        } else {
            try {
                fs.statSync(outputFileLoc).isDirectory();
            } catch (e) {
                // Invalid folder path specified
                isValid = false;
                errors.push(getV2Messages().INVALID_OUTPUT_FILE);
            }
        }
    }
    return isValid;
}

function displayErrors(errorsHolder) {
    Object.keys(errorsHolder).forEach(i => {
        console.error('Error ' + i + ': ' + errorsHolder[i]); // eslint-disable-line no-console
    });
}

function _computeDefaultFileName(path) {
    let fileName = null;
    let fileNameOrg;
    let index = path.lastIndexOf('/');
    if (index === -1) {
        index = path.lastIndexOf('\\');
    }
    if (index !== -1) {
        fileNameOrg = path.substring(index + 1);
        index = fileNameOrg.lastIndexOf('.');
        fileName = fileNameOrg.substring(0, index) + '.json';
    }
    return fileName;
}

function getMetadataFromFile(path) {
    let edmx;
    try {
        edmx = fs.readFileSync(path, 'utf8');
    } catch (error) {
        errors.push(error);
    }
    if (edmx) {
        defaultFileName = _computeDefaultFileName(path);
    }
    return edmx;
}

function getMetadataFromURL(url) {
    return new Promise(function getMetadata(resolve, reject) {
        request(url, function fetchMetadataUrl(error, response, edmx) {
            if (error) {
                errors.push(error);
                reject(error);
            } else if (edmx) {
                if (!_isValidXML(edmx)) {
                    errors.push(edmx);
                    reject(edmx);
                }
                resolve(edmx);
            }
        });
    });
}

function _generateEDMX2JSON(edmx) {
    // Reinitialize
    let cjson = convert.xml2json(edmx, {
        compact: true,
        spaces: 4
    });
    return JSON.parse(cjson);
}

function generateCSN(edmx, ignorePersistenceSkip, mockServerUc) {
    let csn;
    let odataVersion;
    let edmx2jsonModel;
    _flushErrors();
    odataVersion = common.getVersion(edmx);
    if (odataVersion === 'V2') {
        edmx2jsonModel = _generateEDMX2JSON(edmx);
        return new Promise(function getCsn(resolve, reject) {
            csn = edmxv2CSN.getEdmxv2CSN(edmx2jsonModel, errors, ignorePersistenceSkip, mockServerUc);
            if (csn) {
                resolve(csn);
            } else {
                reject(errors);
            }
        });
    } else if (odataVersion === 'V4') {
        return edmxv4CSN.getEdmxv4CSN(edmx, ignorePersistenceSkip, mockServerUc);
    }
    return new Promise(function invalidFile(resolve, reject) {
        reject(getV2Messages().INVALID_EDMX_METADATA);
    });
}

function _getDefaultFileName() {
    let nameSpace;
    if (defaultFileName === undefined) {
        nameSpace = edmxv2CSN.getNamespace();
        if (nameSpace) {
            defaultFileName = nameSpace + '.json';
        }
    }
    return defaultFileName;
}

function _getNextFileVersion(filePath, index) {
    let extPos = filePath.lastIndexOf('.');
    let fileNameOrg = filePath.substring(0, extPos);
    return fileNameOrg + '_' + index + '.json';
}

function _generateNextFileVersion(filePath) {
    let newFilePath = filePath;
    let index = 0;
    let exists = fs.existsSync(filePath);
    while (exists) {
        newFilePath = _getNextFileVersion(filePath, ++index);
        exists = fs.existsSync(newFilePath);
    }
    return newFilePath;
}

function saveCSNModel(csnDataModel, fileLoc, isOverwriteFile) {
    let filePath;
    let isFileSpecified = false;

    if (fileLoc.endsWith('.json')) {
        isFileSpecified = true;
        filePath = fileLoc;
    } else if (_isDirectory(fileLoc)) {
        // File name not specified
        if (fileLoc.endsWith('/') || fileLoc.endsWith('\\')) {
            filePath = fileLoc + _getDefaultFileName();
        } else {
            filePath = fileLoc + '/' + _getDefaultFileName();
        }
    } else {
        // Invalid output file extension specified
        errors.push(getV2Messages().INVALID_OUTPUT_FILE);
        return;
    }
    if (isFileSpecified === false && isOverwriteFile === false) {
        // Don't overwrite file
        filePath = _generateNextFileVersion(filePath);
    }
    try {
        fs.writeFileSync(filePath, csnDataModel, 'utf8');
        console.log(getV2Messages().SAVE_CSN_MODEL + filePath); // eslint-disable-line no-console
    } catch (error) {
        errors.push(error);
    }
}

module.exports = {
    version,
    getV2Messages,
    isValidInputFile,
    isValidOutputFile,
    getMetadataFromFile,
    getMetadataFromURL,
    generateCSN,
    saveCSNModel,
    getErrorList,
    displayErrors
};
