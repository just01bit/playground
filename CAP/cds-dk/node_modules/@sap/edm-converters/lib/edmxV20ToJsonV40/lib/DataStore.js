'use strict';

const SchemaStore = require('./SchemaStore');

/**
 * The store is used to store data while converting the OData V2 XML to the OData V4 JSON format
 * OData V4 relations are
 * document ID (e.g. root or filename) <---1---n--->Schema(e.g. com.odata.v4.technical.scenario)
 */
class DataStore {

    constructor() {
        /**
         * Schema depended information is stored inside the schema store key is the schema namespace
         * @type {Map<string,SchemaStore>}
         * @private
         */
        this._schemaStoreList = new Map();

        /**
         * List of elements which are processed asynchronously after the XmlParser is finished. These elements are to be processed
         * asynchronously by the {@link TaskProcessor}
         * @type {Array<Element>}
         * @private
         */
        this._asyncTaskList = [];

        /**
         * Store the default entity container of an XML OData metadata document, key it the document ID (e.g. 'root' or filename)
         * @type {Map<string,Object>}
         * @private
         */
        this._defaultContainerforService = new Map();

        /**
         * List of used OData-V4 vocabularies in the generated JSON document, key is the document ID (e.g. 'root' or filename)
         * @type {Map<string,Set<Object>>}
         * @private
         */
        this._usedVocabularies = new Map();

        /**
         * List of schemas to be loaded asynchronously to avoid loading a referenced namespace twice, key is the schema namespace
         * The first key is the schema namespace, the second key is the namespace.
         * @type  {Map<string,Map<string,Element>>}
         * @private
         */
        this._loadList = new Map();

        /**
         * List of currently available annotations. This is used if an annotation in OData V2 is defined on another elements
         * as in OData V4. E.g. FilterRestrictions/RequiredProperties which is defined on an OData V2 property but
         * converted to be an annotation on an OData V4 entity sets which uses the entity type to which the property belongs to.
         * The property adds the annotation with a type (map key) and elements can consume the annotation.
         * @type {Map<string,Set<Object>>}
         * @private
         */
        this._annotations = new Map();

        /**
         * Collects the referenced namespaces defined by the V4 elements Reference and Include
         * @type {Map<any, any>}
         * @private
         */
        this._fileAliasToNs = new Map();

        /**
         * Collects the referenced namespaces and their Uri (to provide the uri to the lazy loading function)
         * @type {Map<any, any>}
         * @private
         */
        this._fileNameSpaceToUri = new Map();
    }

    /**
     * Creates an instance of the SchemaStore to store schema dependent information
     * @param {string}namespace Schema namespace
     * @param {string} file File containing the schema definition
     * @param {boolean} [used] Schema is actually used
     * @returns {SchemaStore} the schema store
     */
    createSchemaStore(namespace, file, used) {
        const st = new SchemaStore(namespace, file, used);
        this._schemaStoreList.set(namespace, st);
        return st;
    }

    /**
     * Returns an instance of the SchemaStore identified by the schema namespace
     * @param {string} namespace
     * @returns {SchemaStore}
     * @private
     */
    _getSchemaStore(namespace) {
        if (this._schemaStoreList.has(namespace)) return this._schemaStoreList.get(namespace);
        return null;
    }

    /**
     * Add a association element to cache
     * @param {string} namespace Schema namespace containing the association
     * @param {string} name Association name
     * @param {Element} elem Association element
     */
    addAssociation(namespace, name, elem) {

        const ns = this.resolveName(namespace, name).namespace;
        this._getSchemaStore(ns).associationList.set(name, elem);
    }

    /**
     * Add a entity type element to cache
     * @param {string} namespace Schema namespace
     * @param {string} name Entity type name
     * @param {Element} elem Entity type element
     */
    addEntityType(namespace, name, elem) {
        const ns = this.resolveName(namespace, name).namespace;
        this._getSchemaStore(ns).entityTypeList.set(name, elem);
    }

    /**
     * Returns a cached association. The association is identified by a full qualified name (aliases are resolved)
     * and looked up in the appropriate schema
     * @param {string} schemaNamespace Source schema namespace which references the entity type. (used for resolving aliases).
     * @param {string}  associationName Association name
     * @returns {Object} OData V4 JSON representation or null if the association has not been found
     */
    getAssociation(schemaNamespace, associationName) {
        const info = this.resolveName(schemaNamespace, associationName);
        const associationNamespace = info.namespace;
        const associationSt = this._getSchemaStore(associationNamespace);

        if (!associationSt) {
            const st = this._getSchemaStore(schemaNamespace);
            st.requiredSchemaAliasOrNs.add(associationNamespace);
            return null;
        }

        return associationSt.associationList.get(info.name); // may return null if the association is declared after it is used
    }

    /**
     * Returns a cached entity type. The entity type is identified by a full qualified name (aliases are resolved)
     * and looked up in the appropriate schema
     * @param {string} schemaNamespace Source schema namespace which references the entity type. (used for resolving aliases).
     * @param {string} entityTypeName Entity type name
     * @returns {Object} OData V4 JSON representation or null if the association has not been found
     */
    getEntityType(schemaNamespace, entityTypeName) {
        const info = this.resolveName(schemaNamespace, entityTypeName);
        const entityTypeNamespace = info.namespace;
        const entityTypeSt = this._getSchemaStore(entityTypeNamespace);

        if (!entityTypeSt) {
            const st = this._getSchemaStore(schemaNamespace);
            st.requiredSchemaAliasOrNs.add(entityTypeNamespace);
            return null;
        }

        return entityTypeSt.entityTypeList.get(info.name); // may return null if the association is declared after it is used
    }

    /**
     * Adds an element to the task list
     * @param {Element} elem Element to be added
     */
    addAsyncTask(elem) {
        this._asyncTaskList.push(elem);
    }

    /**
     * Adds an element to front the task list (use for loading external files)
     * @param {Element} elem Element to be added
     */
    addAsyncTaskFront(elem) {
        this._asyncTaskList.unshift(elem);
    }

    /**
     * Returns the task list
     * @returns {Array<Element>} Task list
     */
    getAsyncTaskList() {
        return this._asyncTaskList;
    }

    /**
     * Get the default entity container of an XML OData metadata document
     * @param {string} fileTag Document ID (e.g. 'root' for the initial XML document)
     * @returns {?string} the entity container name
     */
    getDefaultEntityContainer(fileTag) {
        const info = this._defaultContainerforService.get(fileTag);
        if (info) return info.name;
        return null;
    }

    /**
     * Set the default entity container of an XML OData metadata document.
     * The first set default entity container wins (further set attempts will be ignored).
     * If the default entity container set explicitly the previous container will be overwritten.
     * If a default entity container should be set twice explicitly an error it thrown.
     *
     * @param {string} fileTag Document identifier (e.g. 'root' for the initial XML document)
     * @param {string} container Full qualified name of the entity container
     * @param {string} explicitDefault If true, a previously set entity container will be overwritten. If false and there is a
     * previously explicitly set entity container an error is thrown.
     */
    setDefaultEntityContainer(fileTag, container, explicitDefault) {
        if (!this._defaultContainerforService.has(fileTag)) {
            this._defaultContainerforService.set(fileTag, { explicitDefault: explicitDefault, name: container });
        } else if (explicitDefault) {
            if (!this._defaultContainerforService.get(fileTag).explicitDefault) {
                // default container overwrite implicit setting
                this._defaultContainerforService.set(fileTag, { explicitDefault, name: container });
            } else {
                throw new Error('Only one explicit default container allowed');
            }
        } else {
            // do nothing, first non explicit default container wins
        }
    }


    /**
     * Adds a schema element to the schema list. A schema is identified with the schema namespace
     * @param {Element} elem Element for the schema
     * @param {string} namespace Namespace
     * @param {Object} xmlAttributeAlias SAX xml attribute object containing the alias
     * @param {string} file File containing the schema definition
     *
     */
    addSchemaElementAndAlias(elem, namespace, xmlAttributeAlias, file) {
        if (this._schemaStoreList.has(namespace)) {
            throw new Error('Schema already registered');
        }

        let st = this.createSchemaStore(namespace, file);
        st.setElement(elem);
        st.file = file;

        // register alias to own schema namespace in on schema
        if (xmlAttributeAlias) st.addAlias(xmlAttributeAlias.value, namespace);
    }

    /**
     * Returns the schema element identified by schema namespace
     * @param {string} namespace
     * @returns {Element}
     */
    getSchemaElement(namespace) {
        const st = this._getSchemaStore(namespace);
        return st.element;
    }


    /**
     * Add for a given file tag a association between a namespace and a uri
     * @param {string} fileTag Document identifier (e.g. 'root' for the initial XML document)
     * @param {string} namespace Namespace
     * @param {string} uri Uri for that namespace
     */
    addRefFromNamespaceToUri(fileTag, namespace, uri) {
        let fMap = this._fileNameSpaceToUri.get(fileTag);
        if (!fMap) {
            fMap = new Map();
            this._fileNameSpaceToUri.set(fileTag, fMap);
        }

        fMap.set(namespace, uri);
    }

    /**
     * Return for a given file tag the uri which is associated to that namespace
     * @param {string}  fileTag Document identifier (e.g. 'root' for the initial XML document)
     * @param {string} namespace Namespace
     * @returns {string} uri Uri associated to that namespace
     */
    getRefFromNamespaceToUri(fileTag, namespace) {
        let fMap = this._fileNameSpaceToUri.get(fileTag);
        if (!fMap) return undefined;
        return fMap.get(namespace);
    }

    /**
     * Registers an alias in an document ID, this is used for the OData V4 Reference/include xml elements which
     * are not defined inside an schema
     * @param {string} file Do
     * @param {string} xmlAttributeAlias
     * @param {string} namespace
     */
    addFileReference(file, xmlAttributeAlias, namespace) {
        let fMap = this._fileAliasToNs.get(file);
        if (!fMap) {
            fMap = new Map();
            this._fileAliasToNs.set(file, fMap);
        }

        if (fMap.has(xmlAttributeAlias)) {
            throw new Error('Alias already registered');
        }

        // replace registered aliases with namespaces inside all known schemas
        for (let [, st] of this._schemaStoreList) {
            if (st.file !== file) {
                continue;
            }
            for (let aliasOrNs of st.requiredSchemaAliasOrNs) {
                if (aliasOrNs === xmlAttributeAlias) {
                    st.requiredSchemaAliasOrNs.delete(aliasOrNs);
                    st.requiredSchemaAliasOrNs.add(namespace);
                }
            }
        }

        fMap.set(xmlAttributeAlias, namespace);
    }

    /**
     * Adds an reference to schema, if the alias is inside the required list then this alias will be replaced bye the
     * targetNamespace.
     * @param {string} schemaNamespace Source schema namespace
     * @param {?string} alias Alias for the target namespace
     * @param {string} targetNamespace Target namespace
     */
    addSchemaByReference(schemaNamespace, alias, targetNamespace) {
        let st = this._getSchemaStore(schemaNamespace);

        // if the schema is required already via alias then change the key from alias to namespace
        // only required schemas are loaded
        for (let aliasOrNs of st.requiredSchemaAliasOrNs) {
            if (aliasOrNs === alias) {
                st.requiredSchemaAliasOrNs.delete(aliasOrNs);
                st.requiredSchemaAliasOrNs.add(targetNamespace);
            }
        }

        st.schemaAliasToNs.set(alias, targetNamespace);
    }

    /**
     * Loops over the list of required schema namespace and alias and creates task for loading this namespaces.
     * @returns {Array.<{ namespace: string, uri: string }>}
     */
    updateLoadlist() {
        const added = [];
        for (let [, st] of this._schemaStoreList) {
            for (let ns of st.requiredSchemaAliasOrNs) {
                if (!this._loadList.has(ns)) {
                    // foreign namespace is not in the load list yet
                    const uri = this.getRefFromNamespaceToUri(st.file, ns);
                    const data = { namespace: ns, uri: uri };
                    this._loadList.set(ns, data);
                    added.push(data);
                }
            }
        }
        return added;
    }

    /**
     * Returns the namespace registered for alias, if no namespace is registered, the alias is returned assuming the input
     * was already an alias
     * @param {string} schemaNamespace Schema used for resolving the alias
     * @param {string} alias Alias
     * @returns {string} Namespace
     */
    resolveAlias(schemaNamespace, alias) {
        let resolved = alias;

        const st = this._getSchemaStore(schemaNamespace);

        if (!st) return resolved;

        if (st.schemaAliasToNs.has(alias)) return st.schemaAliasToNs.get(alias);

        const v = this.resolveAliasViaFile(st.file, alias);
        if (v) return v;

        return resolved;
    }

    resolveAliasViaFile(file, alias) {
        if (this._fileAliasToNs.has(file)) {
            const fMap = this._fileAliasToNs.get(file);
            if (fMap.has(alias)) return fMap.get(alias);
        }
        return null;
    }


    /**
     * Split a identifier into name and namespace. If the identifier is not a full qualified name the namespace of the
     * schema is used. Aliases are resolved according the given schema namespace
     * @param {string} schemaNamespace Schema used for resolving the alias
     * @param {string} identifier (Full qualified) name to be resolved
     * @returns {{ name: string, namespace: string }}
     */
    resolveName(schemaNamespace, identifier) {
        const i = identifier.lastIndexOf('.');
        const prePoint = i === -1 ? identifier : identifier.substr(i + 1);
        let nsOrAlias = i === -1 ? schemaNamespace : identifier.substr(0, i);

        return {
            name: prePoint,
            namespace: this.resolveAlias(schemaNamespace, nsOrAlias)
        };
    }

    /**
     * Add an vocabulary reference to an document, the vocabulary information is converted to $Reference later (e.g. when leaving the
     * Edmx XML element).
     * @param {string} fileTag Document ID (e.g. 'root' for the initial XML document)
     * @param {Object} vocabulary Vocabulary to be referenced
     */
    addVocabulary(fileTag, vocabulary) {
        let vocabulariesList = this._usedVocabularies.get(fileTag);
        if (!vocabulariesList) {
            vocabulariesList = new Set();
            this._usedVocabularies.set(fileTag, vocabulariesList);
        }

        if (vocabulariesList.has(vocabulary)) return;
        vocabulariesList.add(vocabulary);
    }

    /**
     * Returns a list of used vocabularies for an document
     * @param {string} fileTag
     * @returns {Set.<Object>}
     */
    getUsedVocabularies(fileTag) {
        if (this._usedVocabularies.has(fileTag)) {
            return this._usedVocabularies.get(fileTag);
        }
        return new Set();
    }

    /**
     * Add a annotation which needs the be converted later {@see this._annotations}
     * If the annotation path create and array only the value is inserted into that array.
     * !!!Elements which are processed asynchronously should not store annotations
     * @param {string} annotationTarget Target to which the annotation can be assigned to (e.g. FunctionSet.js#ANNO_TARGETS.ENTITY_TYPE)
     * @param {Object} v4Vocabulary Vocabulary defining the annotation (e.g. FunctionSet.js#VOC_CORE)
     * @param {string} v4AnnotationPath Path describing the annotations JSON structure (e.g. 'SortRestrictions/NonSortableProperties[]')
     * @param {?string} name Name of the annotation (e.g. 'PropertyA')
     * @param {Object}value Value of the annotation (e.g. 'PropertyA')
     */
    addAnnotation(annotationTarget, v4Vocabulary, v4AnnotationPath, name, value) {
        if (!this._annotations.has(annotationTarget)) {
            this._annotations.set(annotationTarget, new Set());
        }

        this._annotations.get(annotationTarget).add({ v4Vocabulary, v4AnnotationPath, name, value });
    }


    /**
     * Returns all annotations which can be assigned to an given target
     * !!!Elements which are processed asynchronously should not store annotations
     * @param {string} annotationTarget Target to which the annotation can be assigned to (e.g. entity type or property)
     * @returns {Set<Object> | undefined}
     */
    getAnnotationsFor(annotationTarget) {
        if (!this._annotations.has(annotationTarget)) return new Set();
        return this._annotations.get(annotationTarget);
    }

    /**
     * Removes a stored annotation from the list
     * @param {string} annotationTarget Target to which the annotation can be assigned to (e.g. entity type or property)
     * @param {Object} annotationInfo Annotation information
     * @param {string} annotationInfo.v4Vocabulary Vocabulary defining the annotation
     * @param {string} annotationInfo.v4AnnotationPath Path describing the annotations JSON structure
     * @param {*} annotationInfo.value Value of the annotation
     */
    removeAnnotationsFor(annotationTarget, annotationInfo) {
        const t = this._annotations.get(annotationTarget);
        if (!t) return;
        t.delete(annotationInfo);
    }
}

module.exports = DataStore;
