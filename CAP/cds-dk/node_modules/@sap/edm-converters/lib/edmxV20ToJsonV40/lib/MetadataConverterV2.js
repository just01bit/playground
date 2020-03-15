'use strict';

const XmlParser = require('./XmlParser');
const MetadataStore = require('./DataStore');
const JsonBuilder = require('./TaskProcessor');
const Element = require('./Element');
const FunctionSet = require('./FunctionSet');
const UtilsAsync = require('./UtilsAsync');


/**
 * Converts a OData V2 Metadata XML document into an OData V4 Metadata JSON document
 * For API compatibility use the execute method to convert the metadata.
 */
class MetadataConverterV2 {

    /**
     * Constructor
     * @param {Object} options Options
     * @param {InfoLogger} options.logger A logger instance
     * @param {Function} options.xmlProvider Function to be called if a referenced document has to be loaded.
     * The first parameter of the function is an namespace who identifies the XML document
     * The second parameter of the function is a callback function with the parameters Error and Buffer. The buffer should contain the xml.
     * @param {string} options.functionPostfix Postfix added to a name of a function import if the corresponding function is created
     */
    constructor(options) {
        this._options = options;
        this._store = new MetadataStore(options);
        this._functionSet = new FunctionSet(this, 'root', this._store, options);
        this._xmlParser = new XmlParser(this._functionSet, options);
        this._jsonBuilder = new JsonBuilder(this._functionSet, this._store, options);
    }

    /**
     * If an external metadata document is referenced, this method calls the xml provider given be the request options
     * to load that document.
     * @param {string} namespace Namespace to be loaded
     * @param {string} uri Uri of the namespace to be loaded (filled only if provided in the input xml document)
     * @param {Function} cb Callback function to be called if the metadata document has been loaded. The first parameter is
     * error, the second parameter is the loaded xml metadata document as Buffer.
     */
    loadFile(namespace, uri, cb) {
        this._options.xmlProvider(namespace, uri, (err, xml) => {
            if (err) {
                cb(err);
            } else {
                cb(null, xml);
            }
        });
    }

    /**
     * Process an xml document
     * @param {Buffer} data
     * @param {Function} cb Callback function to be called if the metadata document has been loaded. The first parameter is
     * error, the second parameter is the loaded xml metadata document as Buffer.
     * @returns {*}
     */
    processXmlContent(data, cb) {
        const parser = new XmlParser(this._functionSet);
        return parser.parseXml(data, (error) => {
            if (error) return cb(error);
            return this.checkForRequiredDocuments(cb);
        });
    }


    checkForRequiredDocuments(callback) {
        const loadList = this._store.updateLoadlist();
        const loadListErrors = [];
        const fileContents = [];

        if (loadList.length > 0 && !this._options.xmlProvider) {
            return callback(new Error('Unable missing callback function for loading referenced files'));
        }

        const loadContent = (item, cb) => {
            this.loadFile(item.namespace, item.uri, (error, data) => {
                if (!data) {
                    loadListErrors.push(item);
                } else {
                    fileContents.push(data);
                }
                return cb(null);
            });
        };

        const finish = () => {
            if (loadListErrors.length) {
                const error = new Error('Error while loading referenced documents.');
                error._missingNamespaces = loadListErrors;
                return callback(error, null);
            }


            for (const content of fileContents) {
                const loader = new Element('ASYNC', 'ProcessXmlContent', content);
                this._store.addAsyncTaskFront(loader);
            }
            return callback();
        };

        return UtilsAsync.processArrayUntilEmpty(loadList, loadContent, finish);
    }

    /**
     * Converts OData V2 metadata in XML format to OData V4 Metadata in JSON format
     * @param {Buffer} xml Buffer containing the OData V2 Metadata
     * @param {MetadataConverterV2~FinishedCallback} callback Callback to be called if the conversion is finished.
     * The Callbacks first parameter is and error, the second parameter is the converted JSON metadata
     */
    execute(xml, callback) {
        if (!(xml instanceof Buffer)) {
            throw new Error('OData V2 XML file must be provided as Buffer object');
        }

        const finishCallback = (error) => {
            if (error) {
                return callback(error, null, error._missingNamespaces);
            }

            if (!this._xmlParser._rootElem || !this._xmlParser._rootElem._finished) {
                return callback(new Error('Tree incomplete'));
            }

            return callback(null, this._xmlParser._rootElem.getTarget());
        };

        this._xmlParser.parseXml(xml, (error) => {
            if (error) return callback(error);

            return this.checkForRequiredDocuments((checkError) => {
                if (checkError) {
                    return finishCallback(checkError);
                }
                return this._jsonBuilder.buildJsonTree(finishCallback);
            });
        });
    }
}


module.exports = MetadataConverterV2;
