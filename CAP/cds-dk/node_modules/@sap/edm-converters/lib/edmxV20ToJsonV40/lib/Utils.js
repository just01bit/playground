'use strict';

const SAP = 'http://www.sap.com/Protocols/SAPData';  // eslint-disable-line no-internal-info

class Utils {
    constructor(store) {
        this._store = store;
    }

    /**
     * Moves an OData V2 annotations value into an OData V3 annotation.
     * The object to be annotated is given by Element or outTarget.
     * Tracks the used vocabulary which is added as reference later on
     * @param {string} fileTag Used to track use vocabularies
     * @param {Element} elem Element whose target is annotated, if null outTarget is annotated
     * @param {string} v2attrName Name of the OData V2 annotation attribute
     * @param {Object} v4Vocabulary OData V4 Vocabulary
     * @param {string} v4AnnotationName OData V4 Annotation
     * @param {Object} outTarget Object to be annotated
     */
    checkSAPAnnotationPassValue(fileTag, elem, v2attrName, v4Vocabulary, v4AnnotationName, outTarget) {
        const target = outTarget;
        const cs = elem.getNsAttribute(SAP, v2attrName);

        if (!cs) return;
        target['@' + v4Vocabulary.alias + '.' + v4AnnotationName] = cs;
        this._store.addVocabulary(fileTag, v4Vocabulary);
    }

    /**
     * Annotates an object. The object to be annotated is given by Element or outTarget.
     * Tracks the used vocabulary which is added as reference later on
     * @param {string} fileTag Used to track use vocabularies
     * @param {Object} v4Vocabulary OData V4 Vocabulary
     * @param {string} v4AnnotationName OData V4 Annotation
     * @param {Object} outTarget Object to be annotated
     * @param {Object} value Value of the annotation
     */
    addSAPAnnotation(fileTag, v4Vocabulary, v4AnnotationName, outTarget, value) {
        // eslint-disable-next-line no-param-reassign
        outTarget['@' + v4Vocabulary.alias + '.' + v4AnnotationName] = value;
        this._store.addVocabulary(fileTag, v4Vocabulary);
    }

    /**
     * Add stored annotations (e.g. annotations which are moved to diffent edm artifacts)
     * @param {string} fileTag Used to track use vocabularies
     * @param {Object} annotations
     * @param {Object} outTarget
     */
    applyStoredSAPAnnotationPath(fileTag, annotations, outTarget) {
        for (let anno of annotations) {
            this._store.removeAnnotationsFor(annotations, anno);
            this.addSAPAnnotationPath(fileTag, anno.v4Vocabulary, anno.v4AnnotationPath, outTarget, anno.value);
        }
    }

    addSAPAnnotationPath(fileTag, v4Vocabulary, v4AnnotationPath, outTarget, value) {
        Utils.createJsonFromPath('@' + v4Vocabulary.alias + '.' + v4AnnotationPath, outTarget, value);

        this._store.addVocabulary(fileTag, v4Vocabulary);
    }

    moveStoredSAPAnnotationPath(annoTarget, outArray) {
        const annotations = this._store.getAnnotationsFor(annoTarget);
        if (!annotations) return;
        for (let anno of annotations) {
            this._store.removeAnnotationsFor(annoTarget, anno);
            outArray.push(anno);
        }
    }
}

Utils.getContainer = (schema) => {
    for (let k of Object.keys(schema)) {
        const v = schema[k];
        if (v.$Kind === 'EntityContainer') return v;
    }
    return null;
};

Utils.supportedRoleToMultiplicities = {
    '0..1': {
        $Nullable: true,
        $Collection: false
    },
    '0..*': {
        $Nullable: true,
        $Collection: true
    },
    '1..1': {
        $Nullable: false,
        $Collection: false
    },
    '1..*': {
        $Nullable: false,
        $Collection: true
    },
    1: {
        $Nullable: false,
        $Collection: false
    },
    '*': {
        $Nullable: true,
        $Collection: true
    }
};

Utils.padEnd = (text, length) => {
    if (text.length > length) {
        return text;
    }
    return text + ' '.repeat(length - text.length);
};

Utils.createJsonFromPath = (v4AnnotationPath, outTarget, value) => {
    const parts = v4AnnotationPath.split('/');

    let target = outTarget;
    let first = parts.shift();
    while (first) {
        if (parts.length === 0) {
            if (first.endsWith('[]')) {
                // x/y[] --> y is array and value is added to that array
                first = first.substring(0, first.length - 2);
                if (target[first]) {
                    if (!Array.isArray(target[first])) {
                        throw new Error('Last annotation path segment already defined as non array (expected array)');
                    }
                    target[first].push(value);
                } else {
                    target[first] = [value];
                }
            } else if (first.endsWith('{}')) {
                // x/y{} --> error last entry (y) must be attribute name which is used to point to the value
                throw new Error('Last annotation path element can not be an object');
            } else {
                if (target[first]) {
                    // x/y --> but y already exits
                    throw new Error('Annotation already defined');
                }
                target[first] = value;
            }
        } else if (first.endsWith('[]')) {
            // x[]/...
            const newTarget = {};

            first = first.substring(0, first.length - 2);

            if (target[first]) {
                if (!Array.isArray(target[first])) {
                    throw new Error('Annotation path segment already defined as non array (expected array)');
                }
                target[first].push(newTarget);
            } else {
                target[first] = [newTarget];
            }
            target = newTarget;
        } else {
            // x/...
            // x{}/...
            let newTarget = {};
            if (first.endsWith('{}')) first = first.substring(0, first.length - 2);
            if (target[first]) {
                if (Array.isArray(target[first])) {
                    throw new Error('Annotation path segment already defined as array (expected object)');
                }
                newTarget = target[first];
            } else {
                target[first] = newTarget;
            }
            target = newTarget;
        }

        first = parts.shift();
    }
};


/**
 * Check if a has a Nullable attribute. If
 *
 * OData V2: 2.1.3 Property - The default value is Nullable=true.
 * OData V4: 7.2 Type Facets - 7.2.1 Nullable - $Nullable - The value of $Nullable is one of the Boolean literals true or false. Absence of the member means false.
 * OData V4: 8.2 Nullable Navigation Property - $Nullable - The value of $Nullable is one of the Boolean literals true or false. Absence of the member means false.
 *
 * OData V4: 12.8  Return Type                - $Nullable - The value of $Nullable is one of the Boolean literals true or false. Absence of the member means false.
 * OData V4: 12.9  Parameter                  - $Nullable - The value of $Nullable is one of the Boolean literals true or false. Absence of the member means false.
 *
 *
 * @param {Object} target
 * @param {Object} a Structure containing the Nullable attribute
 * @param {Object} a.Nullable Nullable http attribute
 */
Utils.checkNullable = (target, a) => {
    if (!a.Nullable || a.Nullable.value === 'true') { // --> is nullable
        // eslint-disable-next-line no-param-reassign
        target.$Nullable = true;
    }
};


/**
 * V4 7.2.2 MaxLength
 * A positive integer value specifying the maximum length of a binary, stream or string value. For binary or stream values this is the octet length of the binary data, for string values it is the character length.
 * If no maximum length is specified, clients SHOULD expect arbitrary length.
 * @param {Object} target
 * @param {Object} a Structure containing the MaxLength attribute
 * @param {Object} a.MaxLength MaxLength http attribute
 */
Utils.checkMaxLength = (target, a) => {
    if (a.MaxLength) {
        // eslint-disable-next-line no-param-reassign
        target.$MaxLength = Number.parseInt(a.MaxLength.value, 10);
    }
};


/**
 * V4 7.2.3 Precision
 * For a decimal value: the maximum number of significant decimal digits of the property’s value; it MUST be a positive integer.
 * For a temporal value (datetime-with-timezone-offset, duration, or time-of-day): the number of decimal places allowed in the seconds portion of the value; it MUST be a non-negative integer between zero and twelve.
 * @param {Object} target
 * @param {Object} a Structure containing the Precision attribute
 * @param {Object} a.Precision Precision http attribute
 */
Utils.checkPrecision = (target, a) => {
    if (a.Precision) {
        // eslint-disable-next-line no-param-reassign
        target.$Precision = Number.parseInt(a.Precision.value, 10);
    }
};

/**
 * V4 7.2.4 Scale
 * For a decimal value: the maximum number of significant decimal digits of the property’s value; it MUST be a positive integer.
 * For a temporal value (datetime-with-timezone-offset, duration, or time-of-day): the number of decimal places allowed in the seconds portion of the value; it MUST be a non-negative integer between zero and twelve.
 * @param {Object} target
 * @param {Object} a Structure containing the Scale attribute
 * @param {Object} a.Scale Scale http attribute
 */
Utils.checkScale = (target, a) => {
    if (a.Scale) {
        // eslint-disable-next-line no-param-reassign
        target.$Scale = Number.parseInt(a.Scale.value, 10);
    }
};

/**
 * V4 7.2.5 Unicode
 * For a string property the Unicode facet indicates whether the property might contain and accept string values with Unicode characters beyond the ASCII character set. The value false indicates that the property will only contain and accept string values with characters limited to the ASCII character set.
 * If no value is specified, the Unicode facet defaults to true.
 * @param {Object} target
 * @param {Object} a Structure containing the Unicode attribute
 * @param {Object} a.Unicode Unicode http attribute
 */
Utils.checkUnicode = (target, a) => {
    if (a.Unicode && a.Unicode.value === 'false') {
        // eslint-disable-next-line no-param-reassign
        target.$Unicode = false;
    }
};

/**
 * Used if a sub element should be merged with an element but the sub elements target key is already set at the elements target.
 * This function is used to realise function overloading where several sub nodes my have the same target key but differ in the
 * parameters.
 * @param {Element} subElement
 * @param {*} old
 * @param {*} neww
 * @returns {Array}
 */
Utils.collisionResolverArrayToArray = (subElement, old, neww) => {
    if (subElement.getFQN() === ('http://schemas.microsoft.com/ado/2008/09/edm.Function')) {
        if (Array.isArray(old) && Array.isArray(neww)) {
            return old.concat(neww[0]);
        }
    }

    throw new Error(String(subElement._targetKey) + ' already set');

};

module.exports = Utils;
