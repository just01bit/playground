#!/usr/bin/env node

module.exports = require('@sap/cds/bin/cds');

if (!module.parent) {

  // needed to ensure compatibility with previous @sap/cds version
  // Inject new `init` into sap/cds, overwriting the old `init` there.
  // TODO remove this when we have removed old `init` in sap/cds
  if (/^init|i$/.test(process.argv[2])) {
    if (_hasPreviousInitOptions(process.argv)) {
      _showWarningMessage();

    } else {
      // call new init generator
      module.exports(require('./init'));
    }

    return;
  }

  // same for 'cds help [add|init]'
  if (/^help|h|\?$/.test(process.argv[2])) {
    if (/^init|i$/.test(process.argv[3])) {
      const init = require('./init');
      const { format } = require('@sap/cds/bin/utils/term');
      console.log(format.poorMarkdown(init.help));
      return;
    }
  }

  module.exports();
}

function _hasPreviousInitOptions(args) {
  const previousOptions = ['--db-technology', '--insecure', '--java-package', '--modules',
    '--mta', '--odata-version', '--pipeline', '--skip-install', '--skip-sample-models',
    '--srv-memory', '--srv-technology'];

  for (const option of previousOptions) {
    if (args.includes(option)) {
      return true;
    }
  }

  return false;
}

function _showWarningMessage() {

  const message = `
************************************************
You are using 'cds init' with older parameters.
To find out more about the current parameters use

  cds help init

************************************************`;

  const { warn } = require('@sap/cds/bin/utils/term');
  console.log(warn(message));
}
