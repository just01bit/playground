/*

    ODATA EDM to CSN Converter
   ///////////////////////////

Capable of converting:

    1. ODATA V2 EDMX to CSN
    2. ODATA V4 EDMX to CSN
    3. ODATA V4 EDMJ to CSN

*/

var compiler = require('../lib/main');
var inputDirectory = './lib/edmToCsn/test/input/';
var outputDirectory = './lib/edmToCsn/test/output/';

// ODATA V2 EDMX or ODATA V4 EDM(x/j) input

var edm = compiler.getMetadataFromFile(inputDirectory + 'metadata.xml'); // V2 EDMX
//var edm = compiler.getMetadataFromFile(inputDirectory + 'metadata_v4_input.xml'); // V4 EDMX
//var edm = compiler.getMetadataFromFile(inputDirectory + 'V4_edmj.json'); // V4 EDMJ

// CSN Converter API when file is an input
compiler.generateCSN(edm, false, false).then(function callMeBackWhenYouReady(csn) {
    compiler.saveCSNModel(csn, outputDirectory, true);
}).catch((error) => {
    console.log(error);
});

// //CSN converter API when URL is an input
// compiler.getMetadataFromURL('http://services.odata.org/V4/OData/OData.svc/$metadata').then(function getMetadata(edmx) {
// // CSN Converter API
//     compiler.generateCSN(edmx, false).then(function callMeBackWhenYouReady(csn) {
//         compiler.saveCSNModel(csn, outputDirectory+'ODataDemo.json', true);
//     }).catch((error) => {
//         console.log(error);
//     });
// });


