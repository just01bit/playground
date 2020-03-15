/**
 * OData V2 to CSN parser
 */

'use strict';

let serviceNamespace;
let allEntities = [];
let allEntitiesMC = [];
let allEntitySetMap = {};
let allEntitySetMapMC = {};
let allAssociations = {};
let allAssociationSets = {};
let allComplexTypes = {};
let allInheritedComplexTypes = {};
let errors = [];
let oDataVersion;
let getMessages = require('../common/message');

let edmxncdsdatatype = {
    'Edm.String': 'cds.LargeString',
    'Edm.Boolean': 'cds.Boolean',
    'Edm.Int16': 'cds.Integer',
    'Edm.Int32': 'cds.Integer',
    'Edm.Int64': 'cds.Integer64',
    'Edm.Decimal': 'cds.DecimalFloat',
    'Edm.DateTime': 'cds.Timestamp',
    'Edm.DateTimeOffset': 'cds.Timestamp',
    'Edm.Time': 'cds.Time',
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

function _initialize() {
    allEntities.length = 0;
    allEntitiesMC.length = 0;
    allEntitySetMap = {};
    allEntitySetMapMC = {};
    allAssociations = {};
    allAssociationSets = {};
    allComplexTypes = {};
    allInheritedComplexTypes = {};
}

/* function getV2Messages() {
    return getMessages();
} */

function getNamespace() {
    return serviceNamespace;
}

function _isValidEDMX(jsonObj) {
    let isValid = false;
    let edmx;
    let dataServices;
    let schema;
    if (jsonObj) {
        edmx = jsonObj['edmx:Edmx'];
        if (edmx) {
            dataServices = edmx['edmx:DataServices'];
            if (dataServices) {
                schema = dataServices.Schema;
                if (schema) {
                    isValid = true;
                }
            }
        }
    }
    return isValid;
}

function _hasMultipleSchema(jsonObj) {
    let isMultipleSchema = false;
    let schemaArr = jsonObj['edmx:Edmx']['edmx:DataServices'].Schema;
    if (Array.isArray(schemaArr)) {
        errors.push(getMessages().MULTIPLE_SCHEMA_FOUND);
        isMultipleSchema = true;
    }
    return isMultipleSchema;
}

function _hasEntitySets(jsonObj) {
    let isEntitySetsPresent = true;
    let entitySets;
    let entityContainer = jsonObj['edmx:Edmx']['edmx:DataServices'].Schema.EntityContainer;
    if (entityContainer) {
        entitySets = entityContainer.EntitySet;
        if (!entitySets) {
            isEntitySetsPresent = false;
            errors.push(getMessages().MISSING_ENTITYSETS);
        }
    } else {
        isEntitySetsPresent = false;
        errors.push(getMessages().MISSING_ENTITYSETS);
    }
    return isEntitySetsPresent;
}

function _hasEntities(jsonObj) {
    let isPresent = true;
    let entityJson = jsonObj['edmx:Edmx']['edmx:DataServices'].Schema.EntityType;
    if (!entityJson) {
        errors.push(getMessages().MISSING_ENTITIES);
        isPresent = false;
    }
    return isPresent;
}

function _getODataVersion(jsonObj) {
    // Check OData version
    // var oDataVersion = undefined;
    let dataServices = jsonObj['edmx:Edmx']['edmx:DataServices'];
    let dataServicesAttributes = dataServices._attributes;
    if (dataServicesAttributes) {
        oDataVersion = dataServicesAttributes['m:DataServiceVersion'];
    }
    return oDataVersion;
}

function _isValidEDMXProvided(jsonObj) {
    let isValid = false;
    if (_isValidEDMX(jsonObj)) {
        oDataVersion = _getODataVersion(jsonObj);
        if (oDataVersion && (oDataVersion === '1.0' || oDataVersion === '2.0')) {
            isValid = true;
        } else {
            errors.push(getMessages().ODATA_VERSION_SUPPORT);
        }
    } else {
        errors.push(getMessages().INVALID_EDMX_METADATA);
    }
    return isValid;
}

function _validateEDMX(jsonObj) {
    return _isValidEDMXProvided(jsonObj) && !(_hasMultipleSchema(jsonObj)) &&
        _hasEntitySets(jsonObj) && _hasEntities(jsonObj);
}

function _getServiceNameSpace(jsonObj) {
    let schemaArr = jsonObj['edmx:Edmx']['edmx:DataServices'].Schema;
    let schema = schemaArr;
    let schemaAttributes;
    if (Array.isArray(schemaArr)) {
        // TODO: Consider multiple schema.
        errors.push(getMessages().MULTIPLE_SCHEMA_FOUND);
        schema = schemaArr[0];
    }
    Object.keys(schema).forEach(key => {
        if (key === '_attributes') {
            schemaAttributes = schema[key];
        }
    });
    if (schemaAttributes) {
        return schemaAttributes.Namespace;
    }
    return null;
}

function _extractAssociationSet(associationSet) {
    let associations = {};
    Object.keys(associationSet).forEach(key => {
        if (key === '_attributes') {
            associations.Name = associationSet[key].Name;
            associations.End = associationSet.End;
            // allAssociationSets[associationSet[key]['Association']] = associationSet['End'];
            allAssociationSets[associationSet[key].Association] = associations;
        }
    });
}

function _extractAllAssociationSets(associationSets) {
    let i;
    if (associationSets.length) {
        // Has many association sets in metadata
        for (i = 0; i < associationSets.length; i++) {
            _extractAssociationSet(associationSets[i]);
        }
    } else {
        // Has only one association set in metadata
        _extractAssociationSet(associationSets);
    }
}

function _extractAssociation(association) {
    Object.keys(association).forEach(key => {
        if (key === '_attributes') {
            allAssociations[association[key].Name] = association;
        }
    });
}

function _extractAllAssociations(associations) {
    let i;
    if (associations.length) {
        // Has many associations in metadata
        for (i = 0; i < associations.length; i++) {
            _extractAssociation(associations[i]);
        }
    } else {
        // Has only one association in metadata
        _extractAssociation(associations);
    }
}

function _extractEntityFromNamespace(entityName) {
    let entityId = '';
    let pos = entityName.lastIndexOf('.');
    if (pos < 0) {
        return entityId;
    }
    entityId = entityName.substring(pos + 1);
    return entityId;
}

function _extractEntityFromEntitySet(entitySet) {
    let entityName;
    Object.keys(entitySet).forEach(key => {
        if (key === '_attributes') {
            allEntitySetMap[entitySet[key].Name] = entitySet[key].EntityType;
            allEntitySetMapMC[entitySet[key].EntityType] = entitySet[key].Name;
            entityName = _extractEntityFromNamespace(entitySet[key].EntityType);
            allEntities.push(entityName);
            allEntitiesMC.push(entitySet[key].Name);
        }
    });
}

function _extractAllEntityFromEntitySets(entitySets) {
    let i;
    if (entitySets.length) {
        // Has many entity sets in metadata
        for (i = 0; i < entitySets.length; i++) {
            _extractEntityFromEntitySet(entitySets[i]);
        }
    } else {
        // Has only one entity sets in metadata
        _extractEntityFromEntitySet(entitySets);
    }
}

function _extractComplexType(complexType, serviceNamespaceParam) {
    let complexTypeKey = '';
    let baseType = '';
    let properties;
    Object.keys(complexType).forEach(key => {
        if (key === '_attributes') {
            complexTypeKey = serviceNamespaceParam + '.' + complexType[key].Name;
            baseType = complexType[key].BaseType;
        } else if (key === 'Property') {
            properties = complexType.Property;
        }
    });
    allComplexTypes[complexTypeKey] = properties;
    if (complexTypeKey && baseType) {
        allInheritedComplexTypes[complexTypeKey] = baseType;
    }
}

function _extractAllComplexTypes(complexTypes, serviceNamespaceParam) {
    let i;
    if (complexTypes.length) {
        // Has many complex types in metadata
        for (i = 0; i < complexTypes.length; i++) {
            _extractComplexType(complexTypes[i], serviceNamespaceParam);
        }
    } else {
        // Has only one association in metadata
        _extractComplexType(complexTypes, serviceNamespaceParam);
    }
}

function _getServiceEntityProperty(propertyName, dataType, length, precision, scale, displayFormat, isKey) {
    let cdsDataType = null;
    let hasInvalidPrecision = false;
    let propertyJson;
    if (length && length > 0) {
        cdsDataType = edmxncdsdatatype[dataType + '_m'];
    } else if (precision && precision > 0) {
        cdsDataType = edmxncdsdatatype[dataType + '_p'];
        // Falling back to actual data type as precision has no meaning for 'Date' related data types
        if (cdsDataType === undefined) {
            cdsDataType = edmxncdsdatatype[dataType];
            hasInvalidPrecision = true;
        }
    } else if (displayFormat && displayFormat === 'Date') {
        cdsDataType = edmxncdsdatatype[dataType + '_f'];
    } else {
        cdsDataType = edmxncdsdatatype[dataType];
    }

    // Lookup from complex type properties
    if (!cdsDataType && allComplexTypes[dataType]) {
        cdsDataType = dataType;
    }

    // Lookup from inherited complex type properties
    if (!cdsDataType && allInheritedComplexTypes[dataType]) {
        cdsDataType = dataType;
    }

    propertyJson = '"' + propertyName + '": {\n';

    if (isKey) {
        propertyJson = propertyJson + '"key": true,\n';
    }
    propertyJson = propertyJson + '"type":"' + cdsDataType + '"';
    if (length && length > 0) {
        propertyJson = propertyJson + ',\n"length":' + length;
    } else if ((precision && precision > 0) && hasInvalidPrecision === false) {
        propertyJson = propertyJson + ',\n"precision":' + precision;
        if (scale && scale > 0) {
            propertyJson = propertyJson + ',\n"scale":' + scale;
        } else {
            propertyJson = propertyJson + ',\n"scale":' + 0;
        }
    }
    propertyJson = propertyJson + '\n}';
    return propertyJson;
}

function _getServiceComplexType(complexTypeKey, complexType) {
    let complexTypeCSN = '"' + complexTypeKey + '": {\n';
    let complexTypeProperty;
    let i;
    complexTypeCSN = complexTypeCSN + '"kind": "type",\n';
    complexTypeCSN = complexTypeCSN + '"elements": {\n';
    if (complexType) {
        if (complexType.length) {
            // More than one complex types
            for (i = 0; i < complexType.length; i++) {
                complexTypeProperty = complexType[i]._attributes;
                complexTypeCSN = complexTypeCSN + _getServiceEntityProperty(complexTypeProperty.Name,
                    complexTypeProperty.Type, complexTypeProperty.MaxLength,
                    complexTypeProperty.Precision, complexTypeProperty.Scale,
                    complexTypeProperty['sap:display-format'], false);
                if (i !== complexType.length - 1) {
                    complexTypeCSN = complexTypeCSN + ',\n';
                } else {
                    complexTypeCSN = complexTypeCSN + '\n';
                }
            }
        } else {
            // Only one complex type
            complexTypeProperty = complexType._attributes;
            complexTypeCSN = complexTypeCSN + _getServiceEntityProperty(complexTypeProperty.Name,
                complexTypeProperty.Type, complexTypeProperty.MaxLength,
                complexTypeProperty.Precision, complexTypeProperty.Scale,
                complexTypeProperty['sap:display-format'], false);
        }
    }
    complexTypeCSN = complexTypeCSN + '}\n';
    if (allInheritedComplexTypes[complexTypeKey]) {
        complexTypeCSN = complexTypeCSN + ',\n';
        complexTypeCSN = complexTypeCSN + '"includes": ["' + allInheritedComplexTypes[complexTypeKey] + '"]\n';
    }
    complexTypeCSN = complexTypeCSN + '}\n';
    return complexTypeCSN;
}

function _getServiceComplexTypes() {
    let complexTypeCSN = '';
    let complexTypesKeys = Object.keys(allComplexTypes);
    let i;
    let complexTypeKey;
    let complexType;
    for (i = 0; i < complexTypesKeys.length; i++) {
        complexTypeKey = complexTypesKeys[i];
        complexType = allComplexTypes[complexTypesKeys[i]];
        complexTypeCSN = complexTypeCSN + _getServiceComplexType(complexTypeKey, complexType);
        if (i !== complexTypesKeys.length - 1) {
            complexTypeCSN = complexTypeCSN + ',\n';
        } else {
            complexTypeCSN = complexTypeCSN + '\n';
        }
    }
    return complexTypeCSN;
}

function _getEntityName(entity) {
    return entity._attributes.Name;
}

function _parseEntityAttributes(attributes) {
    let entityAttributes = {};
    // Extract only needed entity attributes
    entityAttributes.Name = attributes.Name;
    entityAttributes.BaseType = attributes.BaseType;
    entityAttributes.Abstract = attributes.Abstract;
    return entityAttributes;
}

function _parseEntityKeys(keys) {
    // Care for array or non-array (only one property as key)
    let retKeys = [];
    let i;
    let attributes;
    if (keys.PropertyRef.length) {
        for (i = 0; i < keys.PropertyRef.length; i++) {
            attributes = keys.PropertyRef[i]._attributes;
            retKeys.push(attributes.Name);
        }
    } else {
        retKeys.push(keys.PropertyRef._attributes.Name);
    }
    return retKeys;
}

function _getPropertyAttributes(propAttributes) {
    let propOthers = [];
    propOthers.push(propAttributes.Type);
    if (propAttributes.MaxLength) {
        propOthers.push(propAttributes.MaxLength);
    } else {
        propOthers.push(-1);
    }
    if (propAttributes.Precision) {
        propOthers.push(propAttributes.Precision);
    } else {
        propOthers.push(-1);
    }

    if (propAttributes.Scale) {
        propOthers.push(propAttributes.Scale);
    } else {
        propOthers.push(-1);
    }

    if (propAttributes['sap:display-format']) {
        propOthers.push(propAttributes['sap:display-format']);
    } else {
        propOthers.push(-1);
    }
    return propOthers;
}

function _parseEntityProperty(properties) {
    let propAttributes;
    let retProperties = {};
    let i;
    if (properties.length) {
        // Has more than one entities
        for (i = 0; i < properties.length; i++) {
            propAttributes = properties[i]._attributes;
            retProperties[propAttributes.Name] = _getPropertyAttributes(propAttributes);
        }
    } else {
        // Has only one entity
        propAttributes = properties._attributes;
        retProperties[propAttributes.Name] = _getPropertyAttributes(propAttributes);
    }
    return retProperties;
}

function _parseNavigationProperty(navigationProperties) {
    let retNavProperties = {};
    let navPropAttributes;
    let i;
    if (navigationProperties.length) {
        // Has more than one navigation property
        for (i = 0; i < navigationProperties.length; i++) {
            navPropAttributes = navigationProperties[i]._attributes;
            retNavProperties[navPropAttributes.Name] = navPropAttributes;
        }
    } else {
        // Has only one navigation property
        navPropAttributes = navigationProperties._attributes;
        retNavProperties[navPropAttributes.Name] = navPropAttributes;
    }
    return retNavProperties;
}

function _generateCSNEntityKeys(entityKeysList, entityPropertiesMap) {
    let csnEntity = '';
    let propAttributes;
    let i;
    for (i = 0; i < entityKeysList.length; i++) {
        propAttributes = entityPropertiesMap[entityKeysList[i]];
        csnEntity = csnEntity + _getServiceEntityProperty(entityKeysList[i], propAttributes[0],
            propAttributes[1], propAttributes[2], propAttributes[3], propAttributes[4], true);
        if (i !== entityKeysList.length - 1) {
            csnEntity = csnEntity + ',\n';
        }
    }
    return csnEntity;
}

function _generateCSNEntityProperties(entityKeysList, entityPropertiesMap) {
    let csnEntity = '';
    let entityProperties = Object.keys(entityPropertiesMap);
    let i;
    let property;
    let propAttributes;
    if (entityKeysList.length > 0) {
        if (entityProperties.length > 0) {
            csnEntity = csnEntity + ',\n';
        } else {
            csnEntity = csnEntity + '\n';
        }
    }
    for (i = 0; i < entityProperties.length; i++) {
        property = entityProperties[i];
        // Include Property which are not part of keys
        if (entityKeysList.indexOf(property) === -1) {
            propAttributes = entityPropertiesMap[property];
            csnEntity = csnEntity + _getServiceEntityProperty(property, propAttributes[0], propAttributes[1],
                propAttributes[2], propAttributes[3], propAttributes[4], false);
            if (i !== entityProperties.length - 1) {
                csnEntity = csnEntity + ',\n';
            } else {
                csnEntity = csnEntity + '\n';
            }
        }
    }
    // Last property can be an key; eliminate additional delimiter.
    if (csnEntity && csnEntity.endsWith(',\n')) {
        csnEntity = csnEntity.substring(0, csnEntity.lastIndexOf(',\n')) + '\n';
    }
    return csnEntity;
}

function _getAssociatedEntity(associationEnds, toRole, mockServerUc) {
    let entityName;
    let entitySetName;
    Object.keys(associationEnds).forEach(i => {
        if (toRole === associationEnds[i]._attributes.Role) {
            entitySetName = associationEnds[i]._attributes.EntitySet;
            if (mockServerUc) {
                entityName = serviceNamespace + '.' + entitySetName;
            } else {
                entityName = allEntitySetMap[entitySetName];
            }

        }
    });
    return entityName;
}

function _getCSNMultiplicity(associationEnds, toRole, entityName, mockServerUc) {
    let csn = '';
    let multiplicity;
    let attributes;
    let stop = false;
    Object.keys(associationEnds).forEach(i => {
        if (!stop) {
            attributes = associationEnds[i]._attributes;
            if (mockServerUc) {
                let entityNameWithOutNS = allEntitySetMap[_extractEntityFromNamespace(entityName)];
                if ((toRole === attributes.Role) && entityNameWithOutNS === attributes.Type) {
                    multiplicity = attributes.Multiplicity;
                    stop = true;
                }
            } else {
                if ((toRole === attributes.Role) && entityName === attributes.Type) { // eslint-disable-line no-lonely-if
                    multiplicity = attributes.Multiplicity;
                    stop = true;
                }
            }

        }
    });
    if (multiplicity === '1' || multiplicity === '0..1') {
        // When multiplicity is '1' then in CSN we NO need to generate 'cardinality' section
        return csn;
    }
    if (multiplicity) {
        csn = csn + '"cardinality": {\n';
        csn = csn + '"max": "' + multiplicity + '"\n';
        csn = csn + '}';
    }
    return csn;
}

function _getCSNRefrenentialCondition(navPropName, from, to) {
    let csn = '{\n';
    csn = csn + '"ref": [\n';
    csn = csn + '"' + navPropName + '",\n';
    csn = csn + '"' + from + '"\n';
    csn = csn + ']\n';
    csn = csn + '},\n';

    csn = csn + '"=",\n';

    csn = csn + '{\n';
    csn = csn + '"ref": [\n';
    csn = csn + '"' + to + '"';
    csn = csn + ']\n';
    csn = csn + '}\n';
    return csn;
}

function _getCSNMultipleRefrenentialConditions(refConstraints, navPropName, role) {
    let csn = '';
    csn = csn + '"on": [\n';
    Object.keys(refConstraints).forEach(i => {
        let roleName = refConstraints[i].Principal._attributes.Role;
        let principalProperties = refConstraints[i].Principal.PropertyRef;
        let dependentProperties = refConstraints[i].Dependent.PropertyRef;
        let from = '';
        let to = '';
        if (roleName && roleName === role) {
            from = principalProperties._attributes.Name;
            to = dependentProperties._attributes.Name;
        } else {
            from = dependentProperties._attributes.Name;
            to = principalProperties._attributes.Name;
        }
        csn = csn + _getCSNRefrenentialCondition(navPropName, from, to);
        if (i < refConstraints.length - 1) {
            csn = csn + ',\n';
            csn = csn + '"and",\n';
        }
    });
    csn = csn + ']\n';
    return csn;
}

function _getCSNRefrenentialConditions(refConstraints, navPropName, role) {
    let csn = '';
    let from;
    let to;
    let roleName = refConstraints.Principal._attributes.Role;
    let principalProperties = refConstraints.Principal.PropertyRef;
    let dependentProperties = refConstraints.Dependent.PropertyRef;
    if (dependentProperties.length > 0) {
        // Multiple principal and dependents within Referential Constraint
        csn = csn + '"on": [\n';
        Object.keys(dependentProperties).forEach(i => {
            if (roleName && roleName === role) {
                from = principalProperties[i]._attributes.Name;
                to = dependentProperties[i]._attributes.Name;
            } else {
                from = dependentProperties[i]._attributes.Name;
                to = principalProperties[i]._attributes.Name;
            }
            csn = csn + _getCSNRefrenentialCondition(navPropName, from, to);
            if (i < dependentProperties.length - 1) {
                csn = csn + ',\n';
                csn = csn + '"and",\n';
            }
        });
        csn = csn + ']\n';
    } else {
        // Single principal and dependents within Referential Constraint
        csn = csn + '"on": [\n';
        if (roleName && roleName === role) {
            from = principalProperties._attributes.Name;
            to = dependentProperties._attributes.Name;
        } else {
            from = dependentProperties._attributes.Name;
            to = principalProperties._attributes.Name;
        }
        csn = csn + _getCSNRefrenentialCondition(navPropName, from, to);
        csn = csn + ']\n';
    }
    return csn;
}

function _getCSNRefrenentialConstraints(associations, navPropName, toRole) {
    let csn = '';
    let endProperties;
    let matchingRole = '';
    let refConstraints = associations.ReferentialConstraint;
    if (!refConstraints) {
        return csn;
    }
    endProperties = associations.End;
    Object.keys(endProperties).forEach(i => {
        let role = endProperties[i]._attributes.Role;
        if (role && role === toRole) {
            matchingRole = endProperties[i]._attributes.Role;
        }
    });
    if (refConstraints.length > 0) {
        // Multiple referential constraints within Association
        csn = csn + _getCSNMultipleRefrenentialConditions(refConstraints, navPropName, matchingRole);
    } else {
        // Single referential constraint within Association
        csn = csn + _getCSNRefrenentialConditions(refConstraints, navPropName, matchingRole);
    }
    return csn;
}

function _getCSNAssociatedRefrenentialConstraints(associations, toRole, entityName, navPropName, mockServerUc) {
    let csn = '';
    let multiplicity;
    let referentialConstraint;
    csn = csn + '"target": "' + entityName + '"';
    if (!associations) {
        return csn;
    }
    multiplicity = _getCSNMultiplicity(associations.End, toRole, entityName, mockServerUc);
    if (multiplicity) {
        csn = csn + ',\n' + multiplicity;
    }
    referentialConstraint = _getCSNRefrenentialConstraints(associations, navPropName, toRole, mockServerUc);
    if (referentialConstraint) {
        csn = csn + ',\n' + referentialConstraint;
    }
    return csn;
}

function _getCSNAssociatedEntitySet(relationshipName, toRole, navPropName, mockServerUc) {
    let associationSet = allAssociationSets[relationshipName];
    let associationName = associationSet.Name;
    let entityName = _getAssociatedEntity(associationSet.End, toRole, mockServerUc);
    return _getCSNAssociatedRefrenentialConstraints(allAssociations[associationName], toRole,
        entityName, navPropName, mockServerUc);
}

function _getServiceEntityNavigationProperty(navPropAttributes, mockServerUc) {
    let csn = '';
    let navPropName;
    let relationshipName;
    // var fromRole;
    let toRole;
    if (!navPropAttributes) {
        return csn;
    }
    navPropName = navPropAttributes.Name;
    relationshipName = navPropAttributes.Relationship;
    // fromRole = navPropAttributes.FromRole;
    toRole = navPropAttributes.ToRole;

    csn = csn + '"' + navPropName + '": {\n';
    csn = csn + '"type": "cds.Association",\n';
    csn = csn + _getCSNAssociatedEntitySet(relationshipName, toRole, navPropName, mockServerUc);
    csn = csn + '}';

    return csn;
}

function _generateCSNEntityNavigationProperties(entityNavigationPropertiesMap, hasProperties, mockServerUc) {
    let csn = '';
    let i;
    let entityNavProperties;
    let navProperty;
    let navPropAttributes;
    if (!entityNavigationPropertiesMap) {
        return csn;
    }

    entityNavProperties = Object.keys(entityNavigationPropertiesMap);
    if (hasProperties && entityNavProperties.length > 0) {
        // Has navigation properties
        csn = ',\n';
    }
    for (i = 0; i < entityNavProperties.length; i++) {
        navProperty = entityNavProperties[i];
        navPropAttributes = entityNavigationPropertiesMap[navProperty];
        csn = csn + _getServiceEntityNavigationProperty(navPropAttributes, mockServerUc);
        if (i < entityNavProperties.length - 1) {
            csn = csn + ',\n';
        }
    }
    return csn;
}

function _constructServiceEntity(serviceNamespaceParam, entityName, entityKeysList, entityPropertiesMap,
    entityNavigationPropertiesMap, entityAttributes, ignorePersistenceSkip, mockServerUc) {

    let serviceEntityName = serviceNamespaceParam + '.' + entityName;
    let csnEntity = '"' + serviceEntityName + '": {\n';
    let csnKeys;
    let csnProperties;
    let hasProperties;
    csnEntity = csnEntity + '"kind": "entity",\n';
    if (ignorePersistenceSkip === false) {
        csnEntity = csnEntity + '"@cds.persistence.skip": true,\n';
    }
    if (entityAttributes.Abstract && entityAttributes.Abstract.toUpperCase() === 'TRUE') {
        csnEntity = csnEntity + '"abstract": true,\n';
    }
    csnEntity = csnEntity + '"elements": {\n';

    // Key Entity attributes
    csnKeys = _generateCSNEntityKeys(entityKeysList, entityPropertiesMap);
    csnEntity = csnEntity + csnKeys;

    // Non key Entity attributes
    csnProperties = _generateCSNEntityProperties(entityKeysList, entityPropertiesMap);
    csnEntity = csnEntity + csnProperties;

    // No keys and No properties found
    hasProperties = true;
    if (csnKeys.trim() === '' && csnProperties.trim() === '') {
        hasProperties = false;
    }
    // Entity navigation properties
    csnEntity = csnEntity + _generateCSNEntityNavigationProperties(entityNavigationPropertiesMap,
        hasProperties, mockServerUc);
    csnEntity = csnEntity + '}\n';

    if (entityAttributes.BaseType) {
        csnEntity = csnEntity + ',\n';
        csnEntity = csnEntity + '"includes": ["' + entityAttributes.BaseType + '"]\n';
    }
    return csnEntity;
}

function _parseServiceEntity(serviceNamespaceParam, entityName, entity, ignorePersistenceSkip, mockServerUc) {
    let entityAttributes;
    let entityKeysList;
    let entityPropertiesMap;
    let entityNavigationPropertiesMap;
    Object.keys(entity).forEach(key => {
        if (key === '_attributes') {
            entityAttributes = _parseEntityAttributes(entity[key]);
        } else if (key.toUpperCase() === 'Key'.toUpperCase()) {
            entityKeysList = _parseEntityKeys(entity[key]);
        } else if (key.toUpperCase() === 'Property'.toUpperCase()) {
            entityPropertiesMap = _parseEntityProperty(entity[key]);
        } else if (key.toUpperCase() === 'NavigationProperty'.toUpperCase()) {
            entityNavigationPropertiesMap = _parseNavigationProperty(entity[key]);
        }
    });
    // No keys in entity
    if (entityKeysList === undefined || entityKeysList == null) {
        entityKeysList = [];
    }
    // No properties in entity
    if (entityPropertiesMap === undefined || entityPropertiesMap == null) {
        entityPropertiesMap = [];
    }
    // No navigation properties in entity
    if (entityNavigationPropertiesMap === undefined || entityNavigationPropertiesMap == null) {
        entityNavigationPropertiesMap = [];
    }
    // If inherited entity found
    if (entityAttributes.BaseType) {
        allEntities.push(_extractEntityFromNamespace(entityAttributes.BaseType));
    }
    return _constructServiceEntity(serviceNamespaceParam, entityName, entityKeysList,
        entityPropertiesMap, entityNavigationPropertiesMap, entityAttributes, ignorePersistenceSkip, mockServerUc);
}

function _getServiceEntitites(serviceNamespaceParam, entityJson, ignorePersistenceSkip, mockServerUc) {
    let serviceEntities = '';
    let entityName = '';
    let entity;
    let i;
    if (entityJson.length) {
        for (i = 0; i < entityJson.length; i++) {
            // Only entities mentioned in entitysets are considered.
            if (mockServerUc) {
                entityName = allEntitySetMapMC[serviceNamespaceParam + '.' + _getEntityName(entityJson[i])];
            } else {
                entityName = _getEntityName(entityJson[i]);
            }
            if (!mockServerUc && allEntities.indexOf(entityName) > -1) {
                entity = _parseServiceEntity(serviceNamespaceParam, entityName,
                    entityJson[i], ignorePersistenceSkip, mockServerUc);
                serviceEntities = serviceEntities + entity;
                if (i < entityJson.length - 1) {
                    serviceEntities = serviceEntities + '},';
                } else {
                    serviceEntities = serviceEntities + '}';
                }
                serviceEntities = serviceEntities + '\n';
            } else if (allEntitiesMC.indexOf(entityName) > -1) {
                entity = _parseServiceEntity(serviceNamespaceParam, entityName, entityJson[i],
                    ignorePersistenceSkip, mockServerUc);
                serviceEntities = serviceEntities + entity;
                if (i < entityJson.length - 1) {
                    serviceEntities = serviceEntities + '},';
                } else {
                    serviceEntities = serviceEntities + '}';
                }
                serviceEntities = serviceEntities + '\n';
            }
        }
    } else {
        if (mockServerUc) {
            entityName = allEntitySetMapMC[serviceNamespaceParam + '.' + _getEntityName(entityJson)];
        } else {
            entityName = _getEntityName(entityJson);
        }
        if (!mockServerUc && allEntities.indexOf(entityName) > -1) {
            entity = _parseServiceEntity(serviceNamespaceParam, entityName, entityJson,
                ignorePersistenceSkip, mockServerUc);
            serviceEntities = serviceEntities + entity;
            serviceEntities = serviceEntities + '}\n';
        } else if (allEntitiesMC.indexOf(entityName) > -1) {
            entity = _parseServiceEntity(serviceNamespaceParam, entityName, entityJson,
                ignorePersistenceSkip, mockServerUc);
            serviceEntities = serviceEntities + entity;
            serviceEntities = serviceEntities + '}\n';
        }
    }
    return serviceEntities;
}

function _generateEDMXJSON2CSN(jsonObj, serviceNamespaceParam, ignorePersistenceSkip, mockServerUc) {
    let associations;
    let entitySets;
    let complexTypes;
    let entityJson;
    let csnDataModel;
    // Extract association sets
    let associationSets = jsonObj['edmx:Edmx']['edmx:DataServices'].Schema.EntityContainer.AssociationSet;
    if (associationSets) {
        _extractAllAssociationSets(associationSets);
    }
    // Extract associations
    associations = jsonObj['edmx:Edmx']['edmx:DataServices'].Schema.Association;
    if (associations) {
        _extractAllAssociations(associations);
    }
    // Extract entities from EntitySets
    entitySets = jsonObj['edmx:Edmx']['edmx:DataServices'].Schema.EntityContainer.EntitySet;
    if (entitySets) {
        _extractAllEntityFromEntitySets(entitySets);
    }
    // Extract complex types
    complexTypes = jsonObj['edmx:Edmx']['edmx:DataServices'].Schema.ComplexType;
    if (complexTypes) {
        _extractAllComplexTypes(complexTypes, serviceNamespaceParam);
    }
    // Construct CSN entity based on EDMX entity
    entityJson = jsonObj['edmx:Edmx']['edmx:DataServices'].Schema.EntityType;
    csnDataModel = '{\n"definitions": {\n';
    if (mockServerUc) {
        csnDataModel = csnDataModel + '"' + serviceNamespaceParam + '": {\n';
        csnDataModel = csnDataModel + '"kind": "service" },\n';
    }

    // If complex type exists
    if (complexTypes) {
        csnDataModel = csnDataModel + _getServiceComplexTypes();
        csnDataModel = csnDataModel + ',\n';
    }
    csnDataModel = csnDataModel + _getServiceEntitites(serviceNamespaceParam, entityJson,
        ignorePersistenceSkip, mockServerUc);

    // Definitions and Final closure
    csnDataModel = csnDataModel + '}}\n';
    return JSON.stringify(JSON.parse(csnDataModel), null, 4);
    // return csnDataModel;
}

function getEdmxv2CSN(edmx2jsonModel, paramErrors, ignorePersistenceSkip, mockServerUc) {
    let csnDataModel;
    let isValid;
    errors = paramErrors;
    _initialize();
    isValid = _validateEDMX(edmx2jsonModel);
    if (isValid) {
        if (oDataVersion && (oDataVersion === '1.0' || oDataVersion === '2.0')) {
            serviceNamespace = _getServiceNameSpace(edmx2jsonModel);
            csnDataModel = _generateEDMXJSON2CSN(edmx2jsonModel, serviceNamespace, ignorePersistenceSkip, mockServerUc);
        }
    }
    return csnDataModel;
}


module.exports = {
    getEdmxv2CSN,
    getNamespace
};
