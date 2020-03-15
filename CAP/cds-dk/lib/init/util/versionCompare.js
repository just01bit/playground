/**
 * VersionComparer
 * Simple semver comparer w/o the complex stuff. It only compares major, minor, patch, and build
 * segments.
 *
 * Usage:
 * const versionCompare = require('./versionCompare');
 * versionCompare(v1, v2) > 0    ->   v1 > v2
 * versionCompare(v1, v2) < 0    ->   v1 < v2
 * versionCompare(v1, v2) === 0  ->   v1 = v2
 * 1.2.3-SNAPSHOT > 1.2.3
 * 1.2.3-SNAPSHOT = 1.2.3-SNAPSHOT
 * 1.2.3-SNAPSHOT > 1.2.3-0
 * 1.2.3-SNAPSHOT > 1.2.3-12
 * -> SNAPSHOT corresponds to maxInt
 */

"use strict";


const _REGEX = /^(\d*)\.(\d+)\.(\d+)(?:-(\d+|SNAPSHOT))?$/i;
const SNAPSHOT = 'SNAPSHOT';

module.exports = function versionCompare(a, b) { //NOSONAR

    const parsedA = _REGEX.exec(a);
    const parsedB = _REGEX.exec(b);

    let errMessage = "";
    if (parsedA.length < 4 || parsedA.length > 5) {
        errMessage = `Invalid parameter a: ${a}. `;
    }

    if (parsedB.length < 4 || parsedB.length > 5) {
        errMessage = errMessage + `Invalid parameter b: ${b}.`;
    }

    if (errMessage) {
        throw new Error(errMessage);
    }

    const majorA = parseInt(parsedA[1]);
    const majorB = parseInt(parsedB[1]);
    if (majorA !== majorB) {
        return (majorA > majorB ? 1 : -1);
    }

    const minorA = parseInt(parsedA[2]);
    const minorB = parseInt(parsedB[2]);
    if (minorA !== minorB) {
        return (minorA > minorB ? 1 : -1);
    }

    const patchA = parseInt(parsedA[3]);
    const patchB = parseInt(parsedB[3]);
    if (patchA !== patchB) {
        return (patchA > patchB ? 1 : -1);
    }

    if (parsedA[4] === SNAPSHOT) {
        parsedA[4] = `${Number.MAX_SAFE_INTEGER}`;
    }
    if (parsedB[4] === SNAPSHOT) {
        parsedB[4] = `${Number.MAX_SAFE_INTEGER}`;
    }
    const buildA = (parsedA[4] ? parseInt(parsedA[4]) : 0);
    const buildB = (parsedB[4] ? parseInt(parsedB[4]) : 0);
    if (buildA !== buildB) {
        return (buildA > buildB ? 1 : -1);
    }

    return 0;
}
