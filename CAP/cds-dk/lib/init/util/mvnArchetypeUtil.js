
class MvnArchetypeUtil {

    get ARCHETYPE_VERSION() {
        return '1.3.0';
    }

    getCmdArgs(projectName, options) {
        const packageName = options['java:package'] || `org.${projectName}`;

        const commandLine = [
            `archetype:generate`,
            `-DarchetypeArtifactId=cds-services-archetype`,
            `-DarchetypeGroupId=com.sap.cds`,
            `-DarchetypeVersion=${this.ARCHETYPE_VERSION}`,
            `-DartifactId=${projectName}`,
            `-DincludeModel=true`,
            `-DgroupId=customer`,
            `-Dversion=1.0-SNAPSHOT`,
            `-Dpackage=${packageName}`,
            // `-DcdsVersion=3.0.0`,
            // `-DincludeModel=false`,

            `-Dstyle.color=always`,
            // `-Djansi.force=true`,
            // `-Dmaven.color=true`,
            // `-Dmaven.color.hide.level=false`,
            '-B' // run maven in batch mode (non interactive), no progress
        ];

        // if (quiet) {
        //     commandLine.push('-q');
        // }

        if (options.verbose) {
            commandLine.push('-X');
        }

        return commandLine;
    }
}

module.exports = new MvnArchetypeUtil();
