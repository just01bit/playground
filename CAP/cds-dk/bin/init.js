module.exports = Object.assign(init, {
  options: ['--add', '--java:package'],
  shortcuts: [],
  flags: ['--force', '--verbose'],
  help: `
# SYNOPSIS

    *cds init* [<project>] [<options>]

    Initializes a new project in folder ./<project>, with the current
    working directory as default.

# OPTIONS

    *--add* <feature | comma-separated list of features>

        Add one or more features while creating the project.
        <feature> can be one of the following:

        *java*     - prepares as a Java-based project
        *hana*     - adds configuration for SAP HANA deployment.
        *mta*      - adds an _mta.yaml_ file out of CDS models and config.
        *pipeline* - adds files for CI/CD pipeline integration.

    *--java:package* <java package name>

        Use the specifed package name when creating a Java based project.

    *--force*

        Overwrite all files.

    *--verbose*

        Show additional console output.

# EXAMPLES

    *cds init* test
    *cds init* test --add java
    *cds init* test --add java,hana --verbose
    *cds init* --add mta

# SEE ALSO

    *cds add* as shortcut for _cds init --add_.

`});

async function init(args, options = {}) {
  const CDSGenerator = require('../lib/init');
  const generator = new CDSGenerator();
  await generator.initCmd(args[0], options);
}
