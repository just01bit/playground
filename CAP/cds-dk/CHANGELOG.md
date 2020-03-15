# Change Log

All notable changes to this project will be documented in this file.

This project adheres to [Semantic Versioning](http://semver.org/).

The format is based on [Keep a Changelog](http://keepachangelog.com/).


## Version 1.6.3 - 2020-03-05

### Changed

### Fixed
- Proper `npm-shrinkwrap.json`
- `cds init` is a bit more relaxed when checking for existing project content


## Version 1.6.0 - 2020-02-25
### Added
- `cds init --add java` now also works with `--hana`

### Changed
- `cds add mta` now creates resources for SAP HANA with an explicit service type `hana`.  If deploying to trial landscapes, this needs to be changed manually to `hanatrial`.

### Fixed
- `cds add mta` now creates valid configuration for `uaa` and `auditlog` resources.


## Version 1.5.0 - 2020-02-10

### Changed
- `cds init` only supports new syntax. See `cds init help` for more info.
- `cds init` now supports adding template `hana` to Java projects.

### Fixed
- `cds add mta` fixes an issue in created mta.yaml for nodejs projects if used in xmake environment.
- `cds add mta` fixes an build order issue in created mta.yaml for java projects. Now service module is built before db module.
- `cds init` does not create `package.json` in db folder.

### Added
- `cds init` adds `private: true` and `license: "UNLICENSED"` to newly generated projects.
- `cds init` adds a default `.hdiconfig` file when using template `hana`.
- `cds init` supports Java package name via `--java:package` parameter.
- `cds init` generates dependency entry for `@sap/hana-client` when using template `hana`.
- `cds init` uses latest `Java archetype` version `1.3.0` for creating Java projects.
- `cds init` now creates a `.cdsrc.json` file.

## Version 1.4.0 - 2019-12-12

### Added
- Abort installation with a hint if `@sap/cds` is installed globally.
- New project generation using `cds init`. See `cds help init` for details.
- `cds init --add java` now creates Java projects with Spring Boot support.
- `cds watch` now also watches `.properties` files

### Fixed
- Find locally installed modules like `passport`, so that `cds watch` and `cds run` behave symmetrically.

## Version 1.3.0 - 2019-11-19

### Fixed
- `cds import` no longer fails due to Windows paths.

### Also see
- Changes of `@sap/cds` 3.20.0
- Changes of `@sap/cds-sidecar-client` 1.1.2

## Version 1.2.0 - 2019-10-31

### Added
- Experimental support for cds init


## Version 1.1.3 - 2019-10-28

### Fixed
- `cds watch` now uses the same lookup paths for models as `cds run`

### Also see
- Changes of `@sap/cds` 3.18.3


## Version 1.1.0 - 2019-10-08

### Added
- Added dependencies to `express` and `sqlite3` to ease development

### Changed
- Improved `cds watch`

### Also see
- Changes of `@sap/cds` 3.18.0
- Changes of `@sap/edm-converters` 1.0.19
- Changes of `@sap/generator-cds` 2.8.3
- Changes of `@sap/cds-sidecar-client` 1.1.1


## Version 1.0.6 - 2019-09-25

### Changed

- Updated version of `@sap/cds` to `3.17.8`


## Version 1.0.5 - 2019-09-24

### Changed

- Updated version of `@sap/cds` to `3.17.7`


## Version 1.0.4 - 2019-09-23

### Changed

- Updated version of `@sap/cds` to `3.17.6`


## Version 1.0.3 - 2019-09-21

### Changed

- Updated version of `@sap/cds` to `3.17.5`


## Version 1.0.2 - 2019-09-19

### Changed

- Updated version of `@sap/cds` to `3.17.4`


## Version 1.0.1 - 2019-09-18

### Changed

- Updated version of `@sap/cds` to `3.17.2`


## Version 1.0.0 - 2019-09-10

### Added

- Initial implementation
- cds watch
- cds import
