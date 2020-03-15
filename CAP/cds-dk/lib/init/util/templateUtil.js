const path = require('path');

const Handlebars = require('handlebars');

const TEMPLATE_EXTENSION = '.hbs';
const TEMPLATE_EXTENSION_REGEX = new RegExp(`${TEMPLATE_EXTENSION}$`);

module.exports = class TemplateUtil {

    constructor(templateRoot, fsUtil) {
        this.templateRoot = templateRoot;
        this.fsUtil = fsUtil;
    }

    async copyFiles(template, destinationPath, templateValues, overwrite = false) {
        const templatePath = this._getTemplatePath(template);

        const files = await this.fsUtil.readdir(templatePath);
        for (const file of files) {
            const src = path.join(templatePath, file);
            const dest = path.join(destinationPath, file);

            const stat = await this.fsUtil.stat(src);
            if (stat.isDirectory()) {
                await this.copyFiles(path.join(template, file), dest, templateValues, overwrite);
            } else if (this._isTemplateFile(file)) {
                await this._writeTemplateFile(src, dest, templateValues, overwrite);
            } else {
                await this.fsUtil.copy(src, dest);
            }
        }
    }

    async _writeTemplateFile(src, destination, templateValues, overwrite = false) {
        const destinationPath = destination.replace(TEMPLATE_EXTENSION_REGEX, '');
        if (overwrite || !(await this.fsUtil.pathExists(destinationPath))) {
            const content = await this._processTemplateFile(src, templateValues);
            await this.fsUtil.writeFile(destinationPath, content);
        }
    }

    async _processTemplateFile(src, templateValues) {
        let content = await this.fsUtil.readFile(src);
        return this._replaceTemplatePlaceholder(content, templateValues);
    }

    _replaceTemplatePlaceholder(content, templateValues) {
        const template = Handlebars.compile(content);
        return template(templateValues);
    }

    _getTemplatePath(templatePath) {
        return path.join(this.templateRoot, templatePath);
    }

    _isTemplateFile(filename) {
        return path.extname(filename) === TEMPLATE_EXTENSION;
    }
}
