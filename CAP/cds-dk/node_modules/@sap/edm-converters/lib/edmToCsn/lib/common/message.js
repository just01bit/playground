'use strict';

const messages = {
    ODATA_VERSION_SUPPORT: 'Only OData version 2.0 is supported. Specify the correct OData model.',
    INVALID_EDMX_METADATA: 'The OData model is not valid. Specify the correct OData model.',
    MULTIPLE_SCHEMA_FOUND: 'OData models with multiple schemas are not supported.',
    MISSING_ENTITYSETS: 'There are no entity sets in the OData model. Specify the correct OData model.',
    MISSING_ENTITIES: 'There are no entities in the OData model. Specify the correct OData model.',
    SAVE_CSN_MODEL: 'Completed the conversion. Saved CSN model to ',
    INVALID_OUTPUT_FILE: 'The output file must be in the JSON format. Specify the correct file extension.',
    SPECIFY_OUTPUT_FILE: 'Specify an output file.',
    SPECIFY_INPUT_FILE: 'Specify an input file or metadata URL.'
};

function getMessages() {
    return messages;
}

module.exports = getMessages;
