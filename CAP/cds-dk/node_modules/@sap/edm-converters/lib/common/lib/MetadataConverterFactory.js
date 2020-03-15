'use strict';

const xmljs = require('xml-js');
const MetadataConverterV2 = require('../../edmxV20ToJsonV40/lib/MetadataConverterV2');
const MetadataConverterV4 = require('../../edmxV40ToJsonV40/lib/MetadataConverter');

/**
 * Factory to create the various converters
 */
class MetadataConverterFactory {

    /**
     * Helper method which creates an abstract syntax tree in JSON from an xml string
     * @param {string} xmlString XML document
     * @returns {any}
     */
    static createAbstractSyntaxTree(xmlString) {
        return JSON.parse(xmljs.xml2json(xmlString, { compact: false }));
    }

    /**
     * Create an converter based on an projection string
     * @param {string} projection Projection information defining the source format and the target format.
     * Sample: '4.0:xml -> 4.0:json' or '4.0:xml -> 2.0:json'
     * @param {Object} options Options passed to the created converter (see converters documentation for more information)
     * @returns {*}
     */
    static create(projection = '4.0:xml -> 4.0:json', options) {
        const targetToLower = projection.toLowerCase();
        const result = targetToLower.split('->')
            .map(elem => elem.trim())
            .map(elem => elem.split(':'))
            .map((elem) => elem.map((name) => name.charAt(0).toUpperCase() + name.substring(1)))
            .reduce((seed, current) => {
                const [version, format] = current;
                return (`${seed}V${version}${format}To`).replace('.', '');
            }, 'createEdmx')
            .slice(0, -2);

        const method = result.charAt(0).toLowerCase() + result.substring(1);
        if (MetadataConverterFactory[method] == null) throw new Error(`No converter available for '${projection}'`);
        return MetadataConverterFactory[method](options);
    }

    /**
     * Create a converter which for converting an OData V2 Edmx in XML into an OData V4 Edmx in JSON
     * Performs the conversion
     * @param {Object} options Options
     * @param {InfoLogger} options.logger A logger instance
     * @param {Function} options.xmlProvider Function to be called if a referenced document has to be loaded.
     * The first parameter of the function is an namespace who identifies the XML document
     * The second parameter of the function is a callback function with the parameters Error and Buffer. The buffer should contain the xml.
     * @param {string} options.functionPostfix Postfix added to a name of a function import if the corresponding function is created
     * @returns {MetadataConverterV2}
     */
    static createEdmxV20XmlToV40Json(options = {}) {
        return new MetadataConverterV2(options);
    }

    /**
     * Create a converter which for converting an OData V4 Edmx in XML into an OData V4 Edmx in JSON
     * @param {Object} options Converteroptions (for info pleace check readme)
     * @returns {MetadataConverterV2}
     */
    static createEdmxV40XmlToV40Json(options = {}) {
        const defaultStrategy = MetadataConverterV4.createOdataV4MetadataXmlToOdataV4CsdlStrategy();

        if (options.astFactory) {
            defaultStrategy.setASTFactory(options.astFactory);
        } else {
            defaultStrategy.setASTFactory((metadata) => {
                return MetadataConverterFactory.createAbstractSyntaxTree(metadata);
            });
        }

        if (options.metadataFactory) defaultStrategy.setMetadataFactory(options.metadataFactory);
        if (options.nodeFactory) defaultStrategy.setXmlNodeFactory(options.nodeFactory);
        if (options.logger) defaultStrategy.setLogger(options.logger);

        if (options.ignore) {
            options.ignore.forEach((nodePrefixAndName) => {
                defaultStrategy.use(nodePrefixAndName, () => null);
            });
        }

        return new MetadataConverterV4(options).addConversion([defaultStrategy]);

    }
}

MetadataConverterFactory.TARGETS = MetadataConverterV4.TARGETS;

module.exports = MetadataConverterFactory;
