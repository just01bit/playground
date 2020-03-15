/* eslint-disable global-require */
'use strict';

/**
 * API
 * @module API
 */

/**
 * This callback is called if the converter has finished processing
 * @callback ConverterCallback
 * @param {Error|null} error Error object if there was an error
 * @param {Object|null} json Converted output structure in JSON
 * @param {Array<{namespace: string, uri:string }>} [missingNamespaces] If referenced namespaces/documents
 * are required but could not be loaded a list of these namespaces/documents is provided here.
 * Document can be referenced with the uri attribute.
 */

/**
 * Use the MetadataConverterFactory to obtain a converter instance
 * @return {{MetadataConverterFactory: MetadataConverterFactory, ConsoleLogger: Logger}} MetadataConverterFactory
 */
module.exports = {
    MetadataConverterFactory: require('./lib/common/lib/MetadataConverterFactory'),
    ConsoleLogger: require('./lib/common/lib/Logger')
};
