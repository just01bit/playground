'use strict';

const sax = require('sax');
const Utils = require('./Utils');
const XmlElement = require('./XmlElement');

/**
 * Parses an XML file, creates and instance of {@link XmlElement} per XML element
 * and calls an registered function depending on the elements namespace and elements name.
 */
class XmlParser {

    /**
     * Constructor
     * @param {FunctionSet} functions Function set for processing the XML elements
     * @param {Object} options Options
     * @param {Object} options.logger A logger instance
     */
    constructor(functions, options = {}) {
        /**
         * Functions to be called for each XML element
         * @type {FunctionSet}
         */
        this._functions = functions;

        /**
         * Stack build and reduced while traversing the XML element
         * @type {Array<Element>}
         * @private
         */
        this._stack = [];

        /**
         * The XML elements content (e.g. <element>content</element>) is emitted from sax before the element end tag
         * event is emitted, the element content is stored this variable and use in the end event.
         * @type {string}
         * @private
         */
        this._rootElem = null;
        this._logger = options.logger;
    }

    /**
     * Start parsing
     * @param {Buffer} xml Source metadata in OData V2 xml format
     * @param {Function} callback Called if finished. First parameter is error objects in case of an error or null.
     */
    parseXml(xml, callback) {
        try {
            this._parser = sax.parser(true, { xmlns: true, position: true });
            this._parser.onopentag = (o) => { this.onStartElement(o); };
            this._parser.onclosetag = () => { this.onEndElement(); };
            this._parser.ontext = (t) => { this.onText(t); };
            this._parser.onerror = (e) => { this.onError(e); };
            this._parser.onend = (e) => {

                return callback(e);
            };

            this._parser.write(xml).close();
        } catch (error) {
            callback(error);
        }
    }


    /**
     * Called from SAX parser before traversing the XML elements sub elements
     * @param {Object} data Element information created by the sax parser
     */
    onStartElement(data) {
        const up = this._stack[this._stack.length - 1];
        const elem = new XmlElement(data, up, {
            line: this._parser.line,
            column: this._parser.column
        });

        let func = this._functions.getFunction(data.uri, 'enter' + data.local);

        if (func) {
            this.logDebug(`Enter ${Utils.padEnd(data.local, 30)} (${this.getName(data)})`);
            this._functions[func](elem, data);
        }

        this._stack.push(elem);
    }

    /**
     * Returns the value of the "Name" attribute of an xml element. Returns empty string if xml element has no name attribute
     * @param {Object} data XML element information return from the sax parser data Value of "Name" attribute
     * @returns {string}
     */
    getName(data) {
        if (!data.attributes) return '';
        if (!data.attributes.Name) return '';
        return data.attributes.Name.value;
    }

    /**
     * Called from SAX parser after traversing the XML elements sub elements
     */
    onEndElement() {
        const element = this._stack.pop();
        const data = element.getData();


        let func = this._functions.getFunction(data.uri, 'leave' + data.local);
        if (!func) {
            this.logWarn(`Function name for element '${data.local}' in namespace '${data.uri}' not registered`);
            return;
        }
        if (!this._functions[func]) {
            this.logWarn(`Function for element '${data.local}' in namespace '${data.uri}' not implemented`);
            return;
        }

        this.logDebug(`Leave ${Utils.padEnd(data.local, 30)} (${this.getName(data)})`);

        this._functions[func](element, data, element.getTarget());

        // An element is finished if there are no remaining sub elements and if the element is not marked
        // for late asynchronous execution
        if (!element._hasAsyncJob && element.getSubElements().size === 0) {
            element.finished();
        }

        const parentElement = element.getParentElement();
        if (parentElement) {
            parentElement.addSubElement(element);
        } else {
            this._rootElem = element;
        }
    }

    /**
     * Called from SAX parser after traversing the XML elements content
     * @param {string} t
     */
    onText(t) {
        if (t && t.trim() !== '') {
            const element = this._stack[this._stack.length - 1];
            if (element) {
                element.setXmlContent(t);
            }
        }
    }

    /**
     * Forward error from sax parser
     * @param {Error} e
     */
    onError(e) {
        throw e;
    }

    /**
     * Log detailed info if logger is available (e.g. when --veryverbose is used)
     * @param {string} info
     */
    logDebug(info) {
        if (this._logger) {
            this._logger.debug(info);
        }
    }

    /**
     * Log warning if logger is available
     * @param {string} warn
     */
    logWarn(warn) {
        if (this._logger) {
            this._logger.warning(warn);
        }
    }
}

module.exports = XmlParser;
