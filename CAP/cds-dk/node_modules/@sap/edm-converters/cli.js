#!/usr/bin/env node
'use strict';

const commander = require('commander');
const Constants = require('./lib/constants');
const version = require('./package').version;


// Setup commander
commander.name(Constants.CONV_NAME);
commander.version(version, '-v, --version');


// ADD NEW CONVERTERS HERE
require('./lib/edmxV20ToJsonV40').attachCommand(commander);
require('./lib/edmxV40ToJsonV40').attachCommand(commander);

commander.allowUnknownOption(true);
commander.on('--help', () => {
    console.log(
        `Use "${Constants.CONV_NAME} --help" for a list of available commands.\n` +
        `Use "${Constants.CONV_NAME} [command] --help" to get information of the command options`);
}).on('command:*', () => {
    console.log(
        `Invalid command: ${commander.args[0]}\n` +
        `Use "${Constants.CONV_NAME} --help" for a list of available commands.\n` +
        `Use "${Constants.CONV_NAME} [command] --help" to get information of the command options`);
    process.exit(1);
});

const info = commander.parse(process.argv);


if (info.args.length === 0) {
    commander.help();
    process.exit(1);
}
