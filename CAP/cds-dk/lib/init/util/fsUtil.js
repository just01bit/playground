const path = require('path');

const fse = require('@sap/cds-foss')('fs-extra')

const UTF_8 = 'utf-8';

module.exports = class FsUtil {

    constructor() {
        this.touchedFiles = new Set();
    }

    async writeFile(filepath, content, skipFileLog = false) {
        if (!skipFileLog) {
            this._addTouchedFile(filepath);
        }
        await fse.outputFile(filepath, content, UTF_8);
    }

    async writeJSON(filepath, object, options = { spaces: 4 }, skipFileLog = false) {
        if (!skipFileLog) {
            this._addTouchedFile(filepath);
        }
        await fse.outputJSON(filepath, object, options);
    }

    async readFile(src) {
        return await fse.readFile(src, UTF_8);
    }

    async readJSON(src) {
        return await fse.readJSON(src);
    }

    async copy(source, destination, options = {}, skipFileLog = false) {
        if (!skipFileLog) {
            this._addTouchedFile(destination);
        }
        await fse.copy(source, destination, options);
    }

    async pathExists(filePath) {
        return await fse.pathExists(filePath);
    }

    async readdir(filePath) {
        return await fse.readdir(filePath);
    }

    getTouchedFiles() {
        return Array.from(this.touchedFiles.keys());
    }

    async mkdirp(folderPath) {
        await fse.mkdirp(folderPath);
    }

    async stat(filePath) {
        return await fse.stat(filePath);
    }

    async hasContent(folderPath) {
        if (await this.pathExists(folderPath)) {
            const projectContent = await this.readdir(folderPath);
            return projectContent.length > 0;
        }

        return false;
    }

    _addTouchedFile(filepath) {
        const relativeFilepath = path.relative('', filepath);
        this.touchedFiles.add(relativeFilepath);
    }
}
