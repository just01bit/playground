'use strict';

// Link to generate API Key for self: https://api.sap.com/api/1.0/apikey/self

let request = require('request');
let beautifier = require('xml-beautifier');
let compiler = require('../lib/main');
let fs = require('fs');

// var apiKeyURL = 'https://api.sap.com/api/1.0/apikey/self';
let apiHubURL = 'https://api.sap.com/odata/1.0/CATALOGSERVICE/ServiceCollection?$format=json';
let apiKey = 'IiypUFveFC5WFJMJDg1qpg2CMe4y7etp';
let errors = {};
let inputPath = './lib/edmToCsn/test/apihub/input/';
let outputPath = './lib/edmToCsn/test/apihub/output/';
let visited = [];

function saveFile(filePath, contents, metadataURL) {
    fs.writeFileSync(filePath, contents, function a(error) {
        if (error) {
            if (metadataURL) {
                errors[metadataURL] = error;
            } else {
                console.log(error);
            }
        }
    });
}

function downloadAPIHubAPI(metadataURL, apiKeyParam) {
    let urlWithoutMetadata;
    let serviceName;
    let res;
    let edmx;
    let edmxBeautified;
    let inputFilePath;
    try {
        if (metadataURL && metadataURL.indexOf('/$metadata') > -1) {
            urlWithoutMetadata = metadataURL.substring(0, metadataURL.indexOf('/$metadata'));
            serviceName = urlWithoutMetadata.substring(urlWithoutMetadata.lastIndexOf('/') + 1);
            if (visited.indexOf(metadataURL) === -1) {
                visited.push(metadataURL);
                request({
                    headers: {
                        apikey: apiKeyParam
                    },
                    uri: metadataURL,
                    method: 'GET'
                  },function downloadMetadata(err, res, edmx) {
                        edmxBeautified = beautifier(edmx);
                        inputFilePath = inputPath + serviceName + '.xml';
                        saveFile(inputFilePath, edmxBeautified, metadataURL);
                        console.log('Persisted in location:' + inputFilePath);
                });
            }
        }
    } catch (error) {
        errors[metadataURL] = error;
    }
}

function saveURLFile() {
    let inputFilePath = './lib/edmToCsn/test/apihub/APIHubURL.txt';
    let urls;
    let i;
    for (i = 0; i < visited.length; i++) {
        urls = urls + visited[i] + '\n';
    }
    saveFile(inputFilePath, urls);
}

function getAPIsFromAPIHub() {
    let jsonObj;
    let allMetadata;
    let metadataURL;
    let i;
    request({
        url: apiHubURL,
        xml: true
    }, function a(error, response, body) {
        if (!error && response.statusCode === 200) {
            jsonObj = JSON.parse(body);
            allMetadata = jsonObj.d.results;
            for (i = 0; i < allMetadata.length; i++) {
                metadataURL = allMetadata[i].MetadataUrl;
                console.log(metadataURL);
                downloadAPIHubAPI(metadataURL, apiKey);
            }
            console.log("Total OData API's=" + allMetadata.length);
            console.log("Processed OData API's=" + visited.length);
            saveURLFile();
        }
    });
}

function saveIt(edmx, outputFilePath) {
    compiler.generateCSN(edmx, false, false).then(function save(csnDataModel) {
        if (csnDataModel !== undefined && csnDataModel != null) {
            compiler.saveCSNModel(JSON.stringify(csnDataModel), outputFilePath, true);
        }
    });
}


function generateCSNFromAPIHubAPIs() {
    let files = fs.readdirSync(inputPath);
    let i;
    let inputFilePath;
    let fileName;
    let position;
    let outputFilePath;
    let edmx;
    for (i = 0; i < files.length; i++) {
        inputFilePath = inputPath + files[i];
        fileName = files[i];
        // Get file name without extension
        position = fileName.indexOf('.');
        if (position !== -1) {
            fileName = fileName.substring(0, position);
        }
        outputFilePath = outputPath + fileName + '.json';
        console.log(inputFilePath);
        console.log(outputFilePath);
        edmx = compiler.getMetadataFromFile(inputFilePath);
        if (edmx) {
            saveIt(edmx, outputFilePath);
        }
    }
}

//Step 1: Download all OData API's from APIHub
getAPIsFromAPIHub();
//Step 2: Generate CSN for all APIHub API's
generateCSNFromAPIHubAPIs();
