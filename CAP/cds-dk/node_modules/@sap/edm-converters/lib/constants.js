'use strict';

const packageJS = require('../package');

module.exports = {
    CONV_NAME: Object.keys(packageJS.bin)[0]
};
