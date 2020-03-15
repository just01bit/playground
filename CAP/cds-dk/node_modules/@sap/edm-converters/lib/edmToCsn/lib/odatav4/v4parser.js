/**
 * OData V4 to CSN parser
 */

'use strict';

let getMessages = require('../common/message');
let versionInfo = require('../../../../package.json').version;
let namespace;
let complexTypes = {};
let enumTypes = {};
let errors = [];
let entitySetToEntityTypeMap = new Map();
let validEdmDatatypes = ['Edm.DateTimeOffset'];


const MetadataConverterFactory = require('../../../common/lib/MetadataConverterFactory');
const edmxncdsdatatype = {
    'Edm.String': 'cds.LargeString',
    'Edm.Boolean': 'cds.Boolean',
    'Edm.Int16': 'cds.Integer',
    'Edm.Int32': 'cds.Integer',
    'Edm.Int64': 'cds.Integer64',
    'Edm.Decimal': 'cds.DecimalFloat',
    'Edm.DateTime': 'cds.Timestamp', // check and remove if needed could be v2 specific
    'Edm.DateTimeOffset': 'cds.Timestamp',
    'Edm.Time': 'cds.Time', // check and remove if needed could be v2 specific
    'Edm.TimeOfDay': 'cds.Time',
    'Edm.Date': 'cds.Date',
    'Edm.Binary': 'cds.LargeBinary',
    'Edm.Guid': 'cds.UUID',
    'Edm.Byte': 'cds.Integer',
    'Edm.SByte': 'cds.Integer',
    'Edm.Double': 'cds.Double',
    'Edm.Single': 'cds.DecimalFloat',
    // Special handling of data types
    'Edm.String_m': 'cds.String', // Max length
    'Edm.Decimal_p': 'cds.Decimal', // Precision, scale
    'Edm.DateTime_f': 'cds.Date', // sap:display-format="Date"
    'Edm.DateTimeOffset_f': 'cds.Date', // sap:display-format="Date"
    'Edm.Binary_m': 'cds.Binary', // Max Length
    'Edm.Byte_m': 'cds.Integer', // Max Length
    'Edm.Double_p': 'cds.Double' // Precision, scale

};

function _isJson(edmx) {
    let isJson = false;
    try {
        JSON.parse(edmx);
        isJson = true;
    } catch (err) {
        isJson = false;
    }
    return isJson;
}

function _isValidDataType(propertyType) {
    if (validEdmDatatypes.includes(propertyType)) {
        return true;
    }
    return false;
}

function generatePropertyCsn(propertyType, isPrimaryKey) {
    let property = {};
    if (isPrimaryKey) {
        property.key = true;
    }
    // conditions have to be made
    if (propertyType.$MaxLength) {
        if (propertyType.$Type) {
            property.type = edmxncdsdatatype[propertyType.$Type + '_m'];
        } else {
            property.type = 'cds.String'; // if type is missing, then it is String type
        }
        property.length = propertyType.$MaxLength;
    } else if (propertyType.$Precision && !_isValidDataType(propertyType.$Type)) {
        property.type = edmxncdsdatatype[propertyType.$Type + '_p'];
        property.precision = propertyType.$Precision;
        if (propertyType.$Scale && propertyType.$Scale == 'variable') {
            property.scale = propertyType.$Precision;
            property.precision = propertyType.$Precision * 2;
        } else {
            property.scale = propertyType.$Scale;
        }
    } else if (propertyType.$Type) {
        property.type = edmxncdsdatatype[propertyType.$Type];
    } else {
        property.type = 'cds.LargeString'; // if type is missing, then it is String type
    }
    return property;
}

function _generateComplexTypePropertyCsn(propertyType) {
    let property = {};
    property.type = propertyType.$Type;
    return property;
}

function _parseAssociationProperty(foreignReference, associationNode, mockServerUc) {
    let associationProperty = {};
    let foreignKeys;
    // var foreignReference = associationNode.$Type;
    let refConstraint = associationNode.$ReferentialConstraint;
    let i;
    let data;
    let ref;
    associationProperty.type = 'cds.Association';
    // associationProperty.target = associationNode.$Type;
    if (mockServerUc && entitySetToEntityTypeMap && entitySetToEntityTypeMap.get(associationNode.$Type)) {
        associationProperty.target = namespace + '.' + entitySetToEntityTypeMap.get(associationNode.$Type);
    } else {
        associationProperty.target = associationNode.$Type;
    }
    // cardinality
    associationProperty.cardinality = {};
    if (associationNode.$Collection) {
        associationProperty.cardinality.max = '*';
    } else {
        associationProperty.cardinality.max = 1;
    }
    // on -> "SalesOrders.CustomerID=CustomerID and SalesOrders.Type=Type"
    if (refConstraint) {
        associationProperty.on = [];
        foreignKeys = Object.keys(refConstraint);
        for (i = 0; i < foreignKeys.length; i++) {
            data = {};
            ref = [];
            ref.push(foreignReference);
            ref.push(refConstraint[foreignKeys[i]]);
            data.ref = ref;
            associationProperty.on.push(data);
            associationProperty.on.push('=');
            data = {};
            ref = [];
            ref.push(foreignKeys[i]);
            data.ref = ref;
            associationProperty.on.push(data);
            if (i < foreignKeys.length - 1) {
                associationProperty.on.push(' and ');
            }
        }
    }
    return associationProperty;
}

function _generateCSNForEntityType(entityTypes, ignorePersistenceSkip, mockServerUc) {
    let entityCsn = {};
    let keySet;
    let curKey;
    let j;
    let propertyType;
    let enumType = {};
    entityTypes.forEach(element => {
        let key = Object.keys(element)[0];
        let baseType = element[key].$BaseType;
        let isAbstract = element[key].$Abstract;
        if (key) {
            entityCsn[key] = {};
            entityCsn[key].kind = 'entity';
            if (!ignorePersistenceSkip) {
                entityCsn[key]['@cds.persistence.skip'] = true;
            }
            // inheritance
            if (baseType) {
                entityCsn[key].includes = [];
                entityCsn[key].includes.push(baseType);
            }
            if (isAbstract) {
                entityCsn[key].abstract = isAbstract;
            }
            entityCsn[key].elements = {};
            keySet = [];
            Object.keys(element[key]).forEach(property => {
                // Annotations names can have either @ or .; Don't add in generated CSN as property.
                // CDS compiler will throw error when property name has special characters
                if ((property.indexOf('@') == -1) && (property.indexOf('.') == -1)) {
                    if (element[key][property] instanceof Object) {
                        if (property === '$Key') {
                            curKey = element[key].$Key;
                            for (j = 0; j < curKey.length; j++) {
                                keySet.push(curKey[j]);
                            }
                        } else if (!element[key][property].$Type || edmxncdsdatatype[element[key][property].$Type]) {
                            propertyType = element[key][property];
                            if (keySet.includes(property)) {
                                entityCsn[key].elements[property] = generatePropertyCsn(propertyType, true);
                            } else {
                                entityCsn[key].elements[property] = generatePropertyCsn(propertyType, false);
                            }
                        } else if (!element[key][property].$Type || enumTypes[element[key][property].$Type]) {
                            enumType.$Type = enumTypes[element[key][property].$Type].$UnderlyingType;
                            if (keySet.includes(property)) {
                                entityCsn[key].elements[property] = generatePropertyCsn(enumType, true);
                            } else {
                                entityCsn[key].elements[property] = generatePropertyCsn(enumType, false);
                            }
                        } else if (complexTypes[element[key][property].$Type]) {
                            propertyType = element[key][property];
                            entityCsn[key].elements[property] = _generateComplexTypePropertyCsn(propertyType);
                        } else if (element[key][property].$Kind === 'NavigationProperty') {
                            entityCsn[key].elements[property] = _parseAssociationProperty(property,
                                element[key][property], mockServerUc);
                        }
                    }
                }
            });
        }
    });
    return entityCsn;
}

function _generateEntityType(entityTypes, schemaData, mockServerUc) {
    let entity = {};
    let temp;
    Object.keys(schemaData).forEach(entityType => {
        entity = {};
        if (schemaData[entityType] instanceof Object) {
            if (schemaData[entityType].$Kind && schemaData[entityType].$Kind === 'EntityType') {
                if (mockServerUc) {
                    let entityTypeName = namespace + '.' + entityType;
                    if (entitySetToEntityTypeMap && entitySetToEntityTypeMap.get(entityTypeName)) {
                        temp = namespace + '.' + entitySetToEntityTypeMap.get(entityTypeName);
                    } else {
                        temp = namespace + '.' + entityType;
                    }
                } else {
                    temp = namespace + '.' + entityType;
                }
                entity[temp] = schemaData[entityType];
                entityTypes.push(entity);
            }
        }
    });
}

function _parseEntityType(schemaDataList, ignorePersistenceSkip, mockServerUc) {
    // collect entity types
    let entityTypes = [];
    let schemaData;
    let i = 0;
    for (i = 0; i < schemaDataList.length; i++) {
        schemaData = schemaDataList[i];
        _generateEntityType(entityTypes, schemaData, mockServerUc);
    }
    // parse it
    return _generateCSNForEntityType(entityTypes, ignorePersistenceSkip, mockServerUc);
}

function _generateEnumType(schemaData) {
    let enumTypeDict = {};
    let temp;
    Object.keys(schemaData).forEach(curEnumType => {
        if (schemaData[curEnumType] instanceof Object) {
            if (schemaData[curEnumType].$Kind && schemaData[curEnumType].$Kind === 'EnumType') {
                temp = namespace + '.' + curEnumType;
                enumTypeDict[temp] = schemaData[curEnumType];
            }
        }
    });
    return enumTypeDict;
}

function _collectEnumType(schemaDataList) {
    // collect complex types
    let schemaData;
    let i = 0;
    for (i = 0; i < schemaDataList.length; i++) {
        schemaData = schemaDataList[i];
        enumTypes = _generateEnumType(schemaData);
    }
    return enumTypes;
}

function _generateComplexType(schemaData) {
    let complexTypeDict = {};
    let temp;
    Object.keys(schemaData).forEach(curComplexType => {
        if (schemaData[curComplexType] instanceof Object) {
            if (schemaData[curComplexType].$Kind && schemaData[curComplexType].$Kind === 'ComplexType') {
                temp = namespace + '.' + curComplexType;
                complexTypeDict[temp] = schemaData[curComplexType];
            }
        }
    });
    return complexTypeDict;
}

function _collectComplexType(schemaDataList) {
    // collect complex types
    let schemaData;
    let i = 0;
    for (i = 0; i < schemaDataList.length; i++) {
        schemaData = schemaDataList[i];
        complexTypes = _generateComplexType(schemaData);
    }
    return complexTypes;
}

function _generateCSNForComplexType(schemaData) {
    let complexCsn = {};
    let cTypes;
    let propertyType;
    let baseType;
    cTypes = _collectComplexType(schemaData);
    Object.keys(cTypes).forEach(element => {
        complexCsn[element] = {};
        complexCsn[element].kind = 'type';
        complexCsn[element].elements = {};
        // inheritance handling
        baseType = cTypes[element].$BaseType;
        if (baseType) {
            complexCsn[element].includes = [];
            complexCsn[element].includes.push(baseType);
        }
        Object.keys(cTypes[element]).forEach(property => { // cTypes[element][property].$Type.startsWith('Edm.')
            if (cTypes[element][property] instanceof Object) {
                if (!cTypes[element][property].$Type || edmxncdsdatatype[cTypes[element][property].$Type]) {
                    propertyType = cTypes[element][property];
                    complexCsn[element].elements[property] = generatePropertyCsn(propertyType, false);
                }
            } else if (complexTypes[cTypes[element][property].$Type]) {
                propertyType = cTypes[element][property];
                complexCsn[element].elements[property] = _generateComplexTypePropertyCsn(propertyType);
            }
        });
    });
    return complexCsn;
}
// ends here
function _generateCSN(edmxAsJson, ignorePersistenceSkip, mockServerUc) {
    // add all the objects that needs to be ignored for parsing.
    let schemaCounter = 0;
    let ignoreObjects = ['$Reference'];
    let csn = {};
    let schemaData = [];
    let tempNamespace = edmxAsJson.$EntityContainer;
    namespace = tempNamespace.substring(0, tempNamespace.lastIndexOf('.'));
    csn.meta = {};
    csn.meta.creator = 'edmx2csn ' + versionInfo;
    csn.$version = '0.2';
    csn.definitions = {};
    if (mockServerUc) {
        let entitySetData = edmxAsJson[namespace];
        let entityContainer;
        Object.keys(entitySetData).forEach(data => {
            if (ignoreObjects.indexOf(data) === -1 && entitySetData[data] instanceof Object) {
                if (entitySetData[data].$Kind && entitySetData[data].$Kind === 'EntityContainer') {
                    entityContainer = entitySetData[data];
                }
            }
        });
        Object.keys(entityContainer).forEach(data => {
            if (ignoreObjects.indexOf(data) === -1 && entityContainer[data] instanceof Object &&
                entityContainer[data].$Type && entityContainer[data].$Collection) {
                entitySetToEntityTypeMap.set(entityContainer[data].$Type, data);
            }
        });
    }
    Object.keys(edmxAsJson).forEach(data => {
        if (ignoreObjects.indexOf(data) === -1 && edmxAsJson[data] instanceof Object) {
            schemaData.push(edmxAsJson[data]);
            schemaCounter += 1;
        }
    });

    // Multiple schema found and currently we don't support
    if (schemaCounter > 1) {
        let errorMsg = getMessages().MULTIPLE_SCHEMA_FOUND;
        errors.push(errorMsg);
        throw errorMsg;
    }
    // Step 1: get all complex types.
    csn.definitions[namespace] = {};
    csn.definitions[namespace].kind = 'service';
    _collectEnumType(schemaData);
    csn.definitions = Object.assign(_generateCSNForComplexType(schemaData), csn.definitions);
    // Step 2: Parsing entity type
    csn.definitions = Object.assign(_parseEntityType(schemaData, ignorePersistenceSkip, mockServerUc), csn.definitions);
    return JSON.stringify(csn, null, 4);
}

function _generateEDMX2JSON(edmx) {
    return new Promise(function getJson(resolve, reject) {
        try {
            const inputBuffer = edmx;
            // create converter
            const v4Conv = MetadataConverterFactory.createEdmxV40XmlToV40Json();
            v4Conv.execute(inputBuffer, (error, json, missingReferencedDocuments) => {
                if (missingReferencedDocuments.length > 0) {
                    console.log(missingReferencedDocuments); // eslint-disable-line no-console
                }
                resolve(json);
            });
        } catch (err) {
            reject(err);
        }
    });
}

function getEdmxv4CSN(edmx, ignorePersistenceSkip, mockServerUc) {
    let csn;
    let edmjConverted;
    if (_isJson(edmx)) {
        return new Promise(function getCsn(resolve, reject) {
            try {
                edmjConverted = JSON.parse(edmx);
                csn = _generateCSN(edmjConverted, ignorePersistenceSkip, mockServerUc);
                if (csn) {
                    resolve(csn);
                } else {
                    reject(errors);
                }
            } catch (err) {
                reject(err);
            }
        });
    }
    return _generateEDMX2JSON(edmx).then(function getCsn(edmj) {
        // now parsing logic
        return _generateCSN(edmj, ignorePersistenceSkip, mockServerUc);
    });
}

module.exports = {
    getEdmxv4CSN
};
