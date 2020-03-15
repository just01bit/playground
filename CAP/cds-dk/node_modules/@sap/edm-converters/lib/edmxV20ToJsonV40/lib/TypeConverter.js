'use strict';

const YEAR = '(\\d{4})';
const MONTH = '(0[1-9]|1[012])';
const DAY = '(0[1-9]|[12]\\d|3[01])';
const HOUR = '([01]\\d|2[0123])';
const MINUTE = '([012345]\\d)';
const SECOND = '([012345]\\d)(\\.\\d{1,12})?';
const DATE = YEAR + '-' + MONTH + '-' + DAY;
const TIME = HOUR + ':' + MINUTE + ':' + SECOND;
const DATE_TIME = String('^' + DATE + 'T' + TIME);
const DATE_TIME_REG = new RegExp(DATE_TIME, '');
const DURATION_REGEXP =
    new RegExp('[-+]?P(?:(\\d+)D)?(?:T(?:(\\d+)H)?(?:(\\d+)M)?(?:(\\d+(?:\\.(?:\\d+?)0*)?)S)?)?', 'i');

const SAP = 'http://www.sap.com/Protocols/SAPData'; // eslint-disable-line no-internal-info

class TypeConverter {

    /**
     * Creates an instance of the TypeConverter.
     * @param {boolean} iEEE754compatible
     */
    constructor(iEEE754compatible = false) {
        this._IEEE754_compatible = iEEE754compatible;
    }

    convertSingleDouble(def) {
        if (Number.isNaN(def)) return 'NaN';
        if (def === Number.POSITIVE_INFINITY) return 'INF';
        if (def === Number.NEGATIVE_INFINITY) return '-INF';
        return def;
    }


    /**
     * Convert V2 DateTimeTo V4 DateTimeOffset
     * @param {string} def V2 Edm.DateTime (e.g. "2017-11-30T13:24:36")
     * @returns {string} V4 Edm.DateTimeOffset (e.g. "2018-05-15T13:24:36.000Z")
     */
    convertV2DateTimeToV4Date(def) {
        const match = DATE_TIME_REG.exec(def);
        if (!match) {
            throw new Error(`Invalid default value '${def}' for Edm.DateTimeOffset`);
        }
        return match[1] + '-' + match[2] + '-' + match[3];
    }


    /**
     * Convert V2 DateTimeTo V4 DateTimeOffset
     * @param {string} def V2 Edm.DateTime (e.g. "2017-11-30T13:24:36")
     * @returns {string} V4 Edm.DateTimeOffset (e.g. "2018-05-15T13:24:36.000Z")
     */
    convertV2DateTimeToV4DateTimeOffset(def) {
        let match = DATE_TIME_REG.test(def);
        if (!match) {
            throw new Error(`Invalid default value '${def}' for Edm.DateTimeOffset`);
        }
        return def + 'Z';
    }

    convertV2StringToV4Duration(def) {
        let match = DURATION_REGEXP.test(def);
        if (!match) {
            throw new Error(`Invalid default value '${def}' for Edm.String with sap:semantics="duration"`);
        }
        return def;
    }

    convertTime(def) {
        let match = DURATION_REGEXP.exec(def);
        return match[2] + ':' + match[3] + ':' + match[4]; // TODO add match[5]
    }


    // For V2 default value representation of the V2 value representation in xml is used
    convertV2TypeToV4(elem, attributes) {
        let target = elem.getTarget();
        // eslint-disable no-param-reassign
        if (!attributes.Type || !attributes.Type.value) {
            throw new Error(`Type missing for property ${attributes.Name ? attributes.Name.value : '<unknown>'} `
                + elem.getPos());
        }

        const v2Type = attributes.Type.value;

        const def = attributes.Default ? attributes.Default.value : null;
        let tmp;

        switch (v2Type) {
            case 'Edm.Binary':
                target.$Type = 'Edm.Binary';
                if (!def) break;
                // V2 Edm.Binary: "X'23AB'" or "binary'23AB'"
                // V4 Edm.Binary: "BinaryValue": "T0RhdGE",
                if (def.startsWith('X')) {
                    tmp = def.substring(2, def.length - 1);
                    target.$Default = Buffer.from(tmp, 'hex').toString('base64');
                } else if (def.startsWith('binary')) {
                    tmp = def.substring(7, def.length - 1);
                    target.$Default = Buffer.from(tmp, 'hex').toString('base64');
                }
                break;
            case 'Edm.Boolean':
                // eslint-disable-next-line no-param-reassign
                target.$Type = 'Edm.Boolean';
                if (!def) break;
                // V2 Edm.Boolean: "true","false","1","0"
                // V4 Edm.Boolean: true, false,
                if (def === 'true' || def === '1') {
                    target.$Default = true;
                } else if (def === 'false' || def === '0') {
                    target.$Default = false;
                } else {
                    throw new Error(`Invalid default value '${def}' for Edm.Boolean`);
                }
                break;
            case 'Edm.SByte':
            case 'Edm.Int16':
            case 'Edm.Int32':
            case 'Edm.Int64':
                // V2 Edm.Int16: "255"
                // V4 Edm.Int16: 255
                target.$Type = v2Type;
                if (!def) break;

                target.$Default = Number.parseInt(def, 10);
                break;
            case 'Edm.Byte':
                target.$Type = 'Edm.Byte';
                if (!def) break;
                // V2 Edm.Byte: "255"
                // V4 Edm.Byte: 255
                target.$Default = Number.parseInt(def, 10);
                break;
            case 'Edm.DateTime':
                if (elem.getNsAttribute(SAP, 'display-format') === 'Date') {
                    // ----> Edm.Date
                    // V2 Edm.DateTime: ">2017-11-30T00:00:00"
                    // V4 Edm.Date: 	"2017-11-30"
                    target.$Type = 'Edm.Date';
                    if (!def) break;
                    target.$Default = this.convertV2DateTimeToV4Date(def);
                } else {
                    // ----> Edm.DateTimeOffset
                    // V2 Edm.DateTime: ">2018-05-15T13:24:36"
                    // V4 Edm.DateTimeOffset: "2018-05-15T13:24:36.098Z"
                    target.$Type = 'Edm.DateTimeOffset';
                    if (!def) break;
                    target.$Default = this.convertV2DateTimeToV4DateTimeOffset(def);
                }

                break;
            case 'Edm.DateTimeOffset':
                target.$Type = 'Edm.DateTimeOffset';

                if (!def) break;
                target.$Default = this.convertV2DateTimeToV4DateTimeOffset(def);
                break;
            case 'Edm.Decimal':
                target.$Type = 'Edm.Decimal';
                if (!def) break;

                // V2 Edm.Double: "3.1415926535897931"
                // V4 Edm.Double: 3.1415926535897931,
                target.$Default = this.convertSingleDouble(def);
                break;
            case 'Edm.Single':
                target.$Type = 'Edm.Single';
                if (!def) break;

                // V2 Edm.Double: "3.1415926535897931"
                // V4 Edm.Double: 3.1415926535897931,
                target.$Default = this.convertSingleDouble(def);
                break;
            case 'Edm.Double':
                target.$Type = 'Edm.Double';
                if (!def) break;

                // V2 Edm.Double: "3.1415926535897931"
                // V4 Edm.Double: 3.1415926535897931,
                target.$Default = this.convertSingleDouble(def);
                break;
            case 'Edm.String':
                if (elem.getNsAttribute(SAP, 'semantics') === 'duration') {
                    // V2 Edm.String: "P12DT23H5M1.1S"
                    // V4 Edm.Duration: "Duration": P12DT23H5M1.1S,
                    target.$Type = 'Edm.Duration';
                    if (!def) break;
                    target.$Default = this.convertV2StringToV4Duration(def);
                } else {
                    if (!def) break;
                    target.$Default = def;
                }
                break;
            case 'Edm.Time':
                // V2 Edm.Time: "PT23H59M59.9999999S"
                // V4 Edm.TimeOfDay: "23:59:59.9999999",
                if (!def) break;
                target.$Default = this.convertTime(def);
                break;
            case 'Edm.TimeOfDay':
                break;
            default:
                // Is complex type
                target.$Type = v2Type;
        }

        //
        //  These OData V4 type have no counterpart in OData V2
        //  "DateValue": "2012-12-03",
        //  "TimeOfDayValue": "07:59:59.999",
        //  "DurationValue": "P12DT23H59M59.999999999999S",
        //  "ColorEnumValue": "Yellow",
        //  "GeographyPoint": {"type": "Point","coordinates":[142.1,64.1]}
    }
}

module.exports = TypeConverter;
