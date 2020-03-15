// OData V2 datatype: https://blogs.sap.com/2017/09/06/payload-structures-in-odata-v2-adapter-for-sap-cloud-platform-integration/
// From CLI: .\node_modules\.bin\edmx2csn -i ..\srv\remote\edmx\exciseduty.xml -o ..\srv\remote\csn\exciseduty.json

'use strict';

var compiler = require('../lib/main');
var fs = require('fs');

var inputPath = './lib/edmToCsn/test/input/';
var outputPath = './lib/edmToCsn/test/output/';
function generateCSNs() {
    var i;
    var inputFilePath;
    var fileName;
    var position;
    var outputFilePath;
    var edmx;
    var ignorePersistenceSkip = false;
    var mockServerUc = false;
    var files = fs.readdirSync(inputPath);
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
        saveCSN(ignorePersistenceSkip, mockServerUc, inputFilePath, outputFilePath);
    }

    compiler.getMetadataFromURL('http://services.odata.org/V4/OData/OData.svc/$metadata').then(edmx => {
        if (edmx) {
            compiler.generateCSN(edmx, ignorePersistenceSkip, mockServerUc).then(function callMeBackWhenYouReady(csnDataModel) {
                if (csnDataModel !== undefined && csnDataModel != null) {
                    var outputPathLoc = './lib/edmToCsn/test/output/ODataDemo_V4.json';
                    compiler.saveCSNModel(csnDataModel, outputPathLoc);
                }
            })
            .catch((error) => {
                console.log(error);
            });
        } else {
            console.log('Could not load metadata');
        }
    }).catch((error) => {
        console.log(error);
    });

}
function saveCSN(ignorePersistenceSkip, mockServerUc, inputFilePath, outputFilePath) {
    var edmx = compiler.getMetadataFromFile(inputFilePath);
    if (edmx) {
        if(inputFilePath == "./lib/edmToCsn/test/input/Metadata_With_Different_Type_Set_Names.xml" || 
        inputFilePath == "./lib/edmToCsn/test/input/Metadata_With_Different_Type_Set_Names_Extra_EntityType.xml" ||
        inputFilePath == "./lib/edmToCsn/test/input/Navigation_Diff_EntitySet_EntityType.xml") {
            compiler.generateCSN(edmx, ignorePersistenceSkip, true).then(function callMeBackWhenYouReady(csnDataModel) {
                if (csnDataModel !== undefined && csnDataModel != null) {
                    compiler.saveCSNModel(csnDataModel, outputFilePath);
                }
            })
            .catch((error) => {
                console.log(error);
            }); 
        } else {
            compiler.generateCSN(edmx, ignorePersistenceSkip, mockServerUc).then(function callMeBackWhenYouReady(csnDataModel) {
                if (csnDataModel !== undefined && csnDataModel != null) {
                    compiler.saveCSNModel(csnDataModel, outputFilePath);
                }
            })
            .catch((error) => {
                console.log(error);
            });
        }
    }
}

// Generate CSN for all Excise Duty API's
generateCSNs();

module.exports = {
    generateCSNs
};
