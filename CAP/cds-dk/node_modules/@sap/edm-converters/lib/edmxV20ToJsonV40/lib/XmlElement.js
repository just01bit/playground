'use strict';

const Element = require('./Element');

/**
 * This class encapsulates an XML element which should be transformed from one XML representation to another. The incoming
 * representation is given via the constructors data parameter, the output representation can be retrieved via getTarget.
 * For more detailed information please see {@link Element}
 */
class XmlElement extends Element {

    /**
     * Constructor
     * @param {Object} xmlData XML data which should be converted
     * @param {Element} parentElement Element which holds the data's parent XML element as data.
     * @param {Object} pos Position in XML document
     */
    constructor(xmlData, parentElement, pos) {
        super(xmlData.uri, xmlData.local, xmlData);
        this._parentElement = parentElement;
        this._pos = pos;
    }

    /**
     * Read an XML attribute with an name space
     * @param {string} ns Attribute name space
     * @param {string} name Attribute name
     * @returns {string}
     */
    getNsAttribute(ns, name) {
        // for (let a of Object.values(this._data.attributes)) {
        for (let k of Object.keys(this._data.attributes)) {
            const a = this._data.attributes[k];
            if (a.uri === ns && a.local === name) {
                return a.value;
            }
        }
        return null;
    }

    /**
     * Return the current read position
     * @returns {string}
     */
    getPos() {
        return ' (Pos: ' + this._pos.line + '/' + this._pos.column + ')';
    }
}

module.exports = XmlElement;
