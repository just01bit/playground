'use strict';
const convert = require('xml-js');


function _isJson(edmx) {
    let isJson = false;
    try {
        JSON.parse(edmx);
        isJson = true;
    } catch (err) {
        isJson = false;
    }
    return isJson;
}

function _generateEDMX2JSON(edmx) {
    // Reinitialize
    return JSON.parse(convert.xml2json(edmx, { compact: true, spaces: 4 }));
}

function _getODataVersion(edmx) {
    let oDataVersion;
    let jsonObj;
    let dataServices;
    let dataServicesAttributes;
    // Check OData version
    if (_isJson(edmx)) {
        return '';
    }
    jsonObj = _generateEDMX2JSON(edmx);
    try {
        dataServices = jsonObj['edmx:Edmx']['edmx:DataServices'];
        dataServicesAttributes = dataServices._attributes;
    } catch (err) {
        oDataVersion = '';
    }
    if (dataServicesAttributes) {
        oDataVersion = dataServicesAttributes['m:DataServiceVersion'];
    } else {
        // V4 edmx
        try {
            oDataVersion = jsonObj['edmx:Edmx']._attributes.Version;
        } catch (err) {
            oDataVersion = '';
        }
    }
    return oDataVersion;
}

function _isOdataV2(fileInputStream) {
    let isV2 = false;
    // existing logic
    const version = _getODataVersion(fileInputStream);
    if (version === '1.0' || version === '2.0') {
        isV2 = true;
    }
    return isV2;
}

function _isOdataV4(fileInputStream) {
    let isV4 = false;
    let version;
    let edmj;
    if (_isJson(fileInputStream)) {
        edmj = JSON.parse(fileInputStream);
        version = edmj.$Version;
        // read $Version from JSON
    } else {
        version = _getODataVersion(fileInputStream);
    }
    if (version === '4.0') {
        isV4 = true;
    }
    return isV4;
}

function getVersion(fileInputStream) {
    // method to find the version
    // input can be JSON or XML
    // if xml, find the version
    // if json, find the version
    let oDataVersion;
    if (_isOdataV2(fileInputStream)) {
        oDataVersion = 'V2';
    } else if (_isOdataV4(fileInputStream)) {
        oDataVersion = 'V4';
    }
    return oDataVersion;
}

module.exports = {
    getVersion
};
