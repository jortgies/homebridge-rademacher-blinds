# homebridge-rademacher-blinds changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [1.0.2] - 2021-09-27
### Security
- bump axios to 0.21.4

## [1.0.1] - 2021-02-23
### Changed
- update dependencies
- Create npm-publish.yml
- Bump axios from 0.19.2 to 0.21.1
- fix configuration example in README

## [1.0.0] - 2020-04-10
### Added
- refactor to homepilot api v5
- handler for obstruction detected
- change default config url, only use base url
  - check the updated `config.json`

## [0.1.1] - 2020-04-10
### Fixed
- refactor to axios library
- remove request library, this is deprecated as of February 2020 see https://github.com/request/request/issues/3142

## 0.1.0 (2020-04-10)
### Added
  - add bump-version.sh, package-lock file
  - fixes #4
  - fixes #2
  - fix wrong handling on external position update
  - fix empty displayName
  - add Troll Comfort blinds
  - fixes #1
  - add manufacturer, model and serial
  - Initial commit

