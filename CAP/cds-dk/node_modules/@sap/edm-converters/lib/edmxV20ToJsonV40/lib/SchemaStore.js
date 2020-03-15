'use strict';

class SchemaStore {
    constructor(namespace, file) {
        this.namespace = namespace;

        this.file = file;

        this.requiredSchemaAliasOrNs = new Set();
        /**
         * V2 Association XML elements are not below the XML element which they affect, they also do not occur
         * in the V4 JSON format, so we keep a list of them here in order to find them when processing
         * the navigation properties which refer to it.
         * The association list is stored per schema, key is the schema namespace.
         * @type {Map<string,Element>}
         */
        this.associationList = new Map();

        /**
         * The entityTypeList list is stored per schema, key is the schema namespace.
         * @type {Map<string,Element>}
         */
        this.entityTypeList = new Map();

        /**
         * Mapping from source schema and alias to a full qualified name for which the alias is used
         * The first key is the schema namespace, the second key is the alias.
         * These mapping is filled by the Using xml element and when leaving the Schema xml element
         * by the Include xml element
         * @type  {Map<string,string>}
         */
        this.schemaAliasToNs = new Map();

        this.element = null;
    }

    addAlias(alias, targetNamespace) {
        if (this.schemaAliasToNs.has(alias)) throw new Error('Alias already used');
        this.schemaAliasToNs.set(alias, targetNamespace);
    }

    setElement(element) {
        this.element = element;
    }


}


module.exports = SchemaStore;
