'use strict';

/**
 * Used as recursion check to avoid circular (endless) dependencies
 * @type {number}
 */
const MAX_RECURSIONS = 10;

/**
 * This class encapsulates an element which should be transformed from one representation to another. The incoming
 * representation is given via the constructors data parameter, the output representation can be retrieved via getTarget().
 * For transforming the data, the name (passed to the constructor) may be used to select the appropriate
 * converter function.
 *
 * In this OData V2 XML to OData V4 JSON metadata converter use case this class is used to store and convert the
 * XML elements to JSON objects. For synchronous parsing and converting of XML element the sub class XmlElement is the
 * appropriate one. The Element class is used directly if a XML element converter function needs to be called
 * asynchronously.
 *
 * The process is as follows:
 *
 * The class Element is used to build an tree while parsing the OData V2 XML metadata document.
 * Ideally and XML Element (via subclass XmlElement) is mapped 1-1 to an Element of this class
 * which itself creates exactly one JSON object to represent the OData V4 metadata.
 * However there are XML elements (e.g. Associations) which affect several V4 JSON objects,
 * but don't create an 'own' V4 JSON objects, and there are XML elements (e.g. FunctionImport) which
 * create two V4 JSON objects. So there is no 1-1 mapping.
 *
 * Do to this, each element holds the original SAX xml parse information and a target structure. This target structure
 * usually contains the OData V2 XML metadata converted to OData V4 JSON metadata, but can also contain arbitrary
 * information. In later processing these target structures are going to be consumed/merged into
 * the parent elements target until the element tree is reduced to one root element which contains the
 * whole metadata in OData V4 format.
 */
class Element {

    /**
     * Constructor
     * @param {string} namespace Namespace of the xml element e.g.: http://docs.oasis-open.org/odata/ns/edmx
     * @param {string} name Name of the xml element (used in conjunction with namespace to find the appropriate processor function
     * @param {Object} data Data which should be converted
     */
    constructor(namespace, name, data) {
        this._fqn = namespace + '.' + name;
        this._name = name;
        this._data = data;

        /**
         * XML parent element
         * @type {?Element}
         * @private
         */
        this._parentElement = null;

        /**
         * XML sub elements
         * @type {Set<Element>}
         * @private
         */
        this._subElements = new Set();

        /**
         * Store how often this element has been processed if its queued for asynchronous execution (used for circular dependency check)
         * @type {number}
         * @private
         */
        this._callCount = 0;

        /**
         * Schema to which this element belongs to (used to pass the schema namespace from the XML element stack when parsing
         * the XML data to the async processing step (where no such stack exits)
         * @type {?string}
         * @private
         */
        this._schemaNameSpace = null;

        /**
         * The result of the XML to JSON conversion. This may be CSDL JSON but can also be any other structure
         * which is to be consumed by the parent node
         * @type {?Object}
         * @private
         */
        this._target = null;

        /**
         * The key name of the converted XML data. The parent node may use
         * this key as attribute name to store _target xmlData inside the parent structure.
         * @type {?string}
         */
        this._targetKey = null;

        /**
         * Used to store additional information, e.g. used to pass property annotations
         * from the XML property object (like UpdateRestrictions/Updatable/Path)
         * to the entity type element and then to the entity set JSON object which implementing this types
         * @type {Object}
         * @private
         */
        this._additionalInfo = null;

        /**
         * If true this elements data has been processed completely. So this element can be deleted after collecting
         * the _target 's data. Of curse if this element is inside a list e.g. der DataStores association list or the
         * DataStores entityTypeList it is still referenced by this list.
         * @type {boolean}
         * @private
         */
        this._finished = false;

        /**
         * Indicates that this element has been put in the stores queue for async processing
         * @type {boolean}
         * @private
         */
        this._hasAsyncJob = false;

        /**
         * Stores the xml elements inner content
         * @type {Object}
         * @private
         */
        this._xmlContent = null;


        this._isAnnotationContainer = false;
    }

    /**
     * Returns the schema namespace which contains this element
     * @returns {string}
     */
    getNamespace() {
        return this._schemaNameSpace;
    }

    /**
     * Returns how often this element has been processed during asynchronous execution
     * @returns {number}
     */
    getCallCount() {
        return this._callCount;
    }

    /**
     * Returns the data stored in this element.
     * @returns {?Object|string}
     */
    getData() {
        return this._data;
    }

    /**
     * Return the xml elements inner content
     * @returns {?Object}
     */
    getXmlContent() {
        return this._xmlContent;
    }

    /**
     * Set the xml elements inner content
     * @param {Object} content
     */
    setXmlContent(content) {
        this._xmlContent = content;
    }

    /**
     * Returns the full qualified name of the element, e.g. used to filter a element list. A "." is use as namespace name separator.
     * @returns {string}
     */
    getFQN() {
        return this._fqn;
    }

    /**
     * Returns the name of this element (e.g. the XML Element name)
     * @returns {string}
     */
    getFunctionName() {
        return this._name;
    }

    /**
     * Set if this element is inside the stores asyncTaskList of the store
     * @param {boolean} hasAsyncJob
     */
    setHasAsyncJob(hasAsyncJob) {
        this._hasAsyncJob = hasAsyncJob;
    }

    /**
     * Return the parent element
     * @returns {?Element}
     */
    getParentElement() {
        return this._parentElement;
    }

    /**
     * Set the parent element
     * @param {Element} parentElement
     * @returns {Element}
     */
    setParentElement(parentElement) {
        this._parentElement = parentElement;
        return this;
    }


    setIsAnnotationContainer() {
        this._isAnnotationContainer = true;
    }

    isAnnotationContainer() {
        return this._isAnnotationContainer;
    }

    /**
     * Returns the result of the xmlData to json conversion, which is consumed by the parent element.
     * The structure
     * - may be merged 1-1 into the parents OData V4 JSON metadata format (into an array or as attribute)
     * - may be converted into attributes
     * - may be split and may affect several parts of the OData V4 JSON tree
     * @returns {Object} Target
     */
    getTarget() {
        return this._target;
    }

    /**
     * Sets the result of the xmlData to json conversion, which is consumed by the parent element.
     * The structure
     * - may be merged 1-1 into the parents OData V4 JSON metadata format (into an array or as attribute)
     * - may be converted into attributes
     * - may be split and may affect several parts of the OData V4 JSON tree
     * - may be moved to differed locations in the target tree
     * @param {Object} target
     * @param {string} [key] If the structure is merged into the parent object as an attribute this key is used as attribute name
     */
    setTarget(target, key) {
        this._target = target;
        if (key) {
            this._targetKey = key;
        }
    }

    /**
     * Returns the key which should be used if this elements target is added as attribute to the parent JSON object
     * @returns {string} Key name
     */
    getTargetKey() {
        return this._targetKey;
    }

    /**
     * Set custom information
     * @param {Object}info
     */
    setAdditionalInfo(info) {
        this._additionalInfo = info;
    }

    /**
     * Get custom information
     * @returns {Object}
     */
    getAddInfo() {
        return this._additionalInfo;
    }

    /**
     * Detach an element from the element tree. This function may be used if the element is stored in a special list
     * (e.g. for association information) but not in the element tree
     */
    detach() {
        if (this._parentElement) {
            this._parentElement.removeSubElement(this);
            this._parentElement = null;
        }
    }

    /**
     * Move element in side the element tree.
     * @param {Element} parentElement Target location in the tree
     * @returns {Element}
     */
    move(parentElement) {
        this.detach();
        this._parentElement = parentElement;
        return this;
    }

    /**
     * Adds an element to the sub element list.
     * @param {Element} node
     */
    addSubElement(node) {
        this._subElements.add(node);
    }

    /**
     * Removes an element from sub element list.
     * @param {Element} node
     */
    removeSubElement(node) {
        this._subElements.delete(node);
    }

    /**
     * Returns the Set containing the sub elements
     * @returns {Set<Element>} Set containing the sub elements
     */
    getSubElements() {
        return this._subElements;
    }

    /**
     * Move this elements sub elements to given element
     * @param {Element} element Element which get the sub elements
     * @param {string} nameFilter Move only elements whose name is matching this filter
     */
    moveSubElementsToElement(element, nameFilter) {
        for (const n of this._subElements) {
            if (n.getFQN() === nameFilter) {
                n._parent = element;
                element.addSubElement(n);
                this._subElements.delete(n);
            }
        }
    }

    /**
     * Go through all finished sub elements and merge their target to the own target.
     * @param {Function} [collisionResolver] Called if the target attribute is and Object and already existing
     */
    mergeSubElementsTargetsToOwnTarget(collisionResolver) {
        this.mergeSubElementsTargetsTo(this._target, undefined, collisionResolver);
    }

    /**
     * Go through all finished sub elements and merge their target to the given target.
     * @param {Object} target Target where the sub elements targets are attached to
     * @param {string} [nameFilter] Move only elements whose name is matching this filter
     * @param {Function} [collisionResolver] Called if the target attribute is and Object and already existing
     */
    mergeSubElementsTargetsTo(target, nameFilter, collisionResolver) {
        for (const n of this._subElements) {
            if (!n._finished) continue;

            if (nameFilter) continue;

            if (n.isAnnotationContainer()) {
                this.mergeSubElementTargetViaKeys(n.getTarget());
                this._subElements.delete(n);
                continue;
            }

            if (Array.isArray(target)) {
                target.push(n._target);
            } else if (!target[n._targetKey]) {
                // eslint-disable-next-line no-param-reassign
                target[n._targetKey] = n._target;
            } else {
                // eslint-disable-next-line no-param-reassign
                target[n._targetKey] = collisionResolver(n, target[n._targetKey], n._target);
            }
            this._subElements.delete(n);
        }

        if (!this._hasAsyncJob && this._subElements.size === 0) {
            this.finished();
        }
    }

    /**
     * Go through all finished own sub elements and add their target to an attribute of the own target.
     * @param {string} attributeName Attribute name to which the targets of the sub elements are attached to.
     * @param {string=} nameFilter Move only elements whose name is matching this filter
     * @param {?Object|Array=} def If the attribute is not available a new attribute is created and def is used as default value
     */
    mergeSubTargetsToOwnTargetAttribute(attributeName, nameFilter, def) {
        this.mergeElementsTargetsToTargetsAttribute(this._target, this._subElements,
            attributeName, nameFilter, def);
    }

    /*
            mergeElementsTargetsToOwnTargetAttribute(elements, attributeName, nameFilter, def) {
            return this.mergeElementsTargetsToTargetsAttribute(this._target, elements, attributeName, nameFilter, def);
        }*/

    /**
     * Go through all finished elements in given subElements and add their target to an attribute of the given target.
     * @param {Object} target Target object to be extended
     * @param {string} attributeName Attribute name to which the targets of the sub elements are attached to.
     * @param {string=} nameFilter Move only elements whose name is matching this filter
     * @param {?Object|Array=} def If the attribute is not available a new attribute is created and def is used as default value
     * Using null as default value means that target is just set, no target key is required.
     */
    mergeSubElementsTargetsToTargetAttribute(target, attributeName, nameFilter, def) {
        this.mergeElementsTargetsToTargetsAttribute(target, this._subElements, attributeName, nameFilter, def);
    }

    /**
     * Go through all finished elements in given subElements and add their target to an attribute of the given target.
     * @param {Object} target Target
     * @param {Set<Element>} subElements Element whose target should be evaluated
     * @param {string} attributeName Attribute name to which the targets of the sub elements are attached to.
     * @param {string=} nameFilter Move only elements whose name is matching this filter
     * @param {?Object|Array=} def If the attribute is not available a new attribute is created and def is used as default value
     * Using null as default value means that target is just set, no target key is required.
     */
    mergeElementsTargetsToTargetsAttribute(target, subElements, attributeName, nameFilter, def) {
        for (const n of subElements) {
            if (!n._finished) continue;

            if (nameFilter && (n.getFQN() !== nameFilter)) continue;

            if (n.isAnnotationContainer()) {
                this.mergeSubElementTargetViaKeys(n.getTarget());
                this._subElements.delete(n);
                continue;
            }

            if (target[attributeName] === undefined) {
                // eslint-disable-next-line no-param-reassign
                target[attributeName] = (def === undefined) ? null : def;
            }

            if (target[attributeName] === null) {
                // eslint-disable-next-line no-param-reassign
                target[attributeName] = n._target;
            } else if (Array.isArray(target[attributeName])) {
                target[attributeName].push(n._target);
            } else {
                if (!n._targetKey) {
                    throw new Error('Missing key for sub node');
                }
                // eslint-disable-next-line no-param-reassign
                target[attributeName][n._targetKey] = n._target;
            }
            this._subElements.delete(n);
        }

        if (!this._hasAsyncJob && this._subElements.size === 0) {
            this.finished();
        }
    }

    mergeSubElementsTargetViaKeys() {
        for (const n of this._subElements) {
            const subTarget = n.getTarget();
            this.mergeSubElementTargetViaKeys(subTarget);
        }
        this._subElements.clear();
    }

    mergeSubElementTargetViaKeys(subTarget) {
        for (const k of Object.keys(subTarget)) {
            this._target[k] = subTarget[k];
        }
    }

    /**
     * Indicate that the element processing has finished. That means the parent node may consume this element target.
     * This element can be deleted to save memory
     */
    finished() {
        this._finished = true;
    }

    /**
     * Sets an element to finished if the element has no async tasks open and all sub elements are processed
     */
    finishedAsync() {
        if (!this._hasAsyncJob && this._subElements.size === 0) {
            this._finished = true;
        }
    }

    /**
     * Add this element into the asynchronous task list. If an sub element of this list is already in the task list,
     * then this element does not need to be added because the task list processor will check the sub elements parents
     * automatically
     * @param {string} schemaName
     * @param {DataStore} store Store whose asynchronous task list is used
     * @param {string} errorHint Text to be added to the error message if MAX_RECURSIONS is reached
     */
    callAgain(schemaName, store, errorHint) {

        this._schemaNameSpace = schemaName;

        let aSub = false;
        for (const n of this._subElements) {
            if (n._hasAsyncJob) aSub = true;
        }

        if (!aSub) {
            this._hasAsyncJob = true;
            store.addAsyncTask(this);
        }
        this._callCount += 1;
        if (this._callCount > MAX_RECURSIONS) {
            let errorDetails = '';
            if (this._data || this._data.attributes || this._data.attributes.Name) {
                errorDetails += 'Processing: ' + this._data.attributes.Name.value;
            }
            if (errorHint) {
                errorDetails += ', Hint: ' + errorHint;
            }

            throw new Error('Too much recursion for element: ' + this.getFQN() + ' Details: ' + errorDetails);
        }
    }
}

module.exports = Element;
