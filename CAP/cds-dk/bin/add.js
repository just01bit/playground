
module.exports = Object.assign(add, {
  options: [],
  shortcuts: [],
  flags: ['--force', '--verbose'],
  help: `
# SYNOPSIS

    *cds add* <feature | comma-separated list of features>

    Adds one or more features to an existing project in the current working
    folder - grow as you go scenario.

    The following <features> are supported so far:

    *hana*     - adds configuration for SAP HANA deployment.
    *mta*      - adds an _mta.yaml_ file out of CDS models and config.
    *pipeline* - adds files for CI/CD pipeline integration.


# OPTIONS

    *--force*

      Overwrite all files in case the target files already exist.

    *--verbose*

      Show additional console output.

# EXAMPLES

    *cds add* pipeline,mta --verbose
    *cds add* mta

# SEE ALSO

  *cds init*

`});

async function add(args, options = {}) {
  const CDSGenerator = require('../lib/init');
  const generator = new CDSGenerator();
  await generator.addCmd(args[0], options);
}
