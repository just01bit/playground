module.exports = {
    OPTION_JAVA: 'java',
    OPTION_HANA: 'hana',
    OPTION_MTA: 'mta',
    OPTION_PIPELINE: 'pipeline',

    // node enum
    PROJECT_TYPE: Object.freeze({ nodejs: 1, java: 2, unknown: 3 }),

    REGEX_JAVA_PACKAGE: /^[a-zA-Z]\w*(\.[a-zA-Z]\w*)*$/g
}
