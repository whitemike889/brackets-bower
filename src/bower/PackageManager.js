/*
 * Copyright (c) 2014 Narciso Jaramillo. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 *
 */

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4,
maxerr: 50, browser: true */
/*global brackets, $, define */

define(function (require, exports) {
    "use strict";

    var _                    = brackets.getModule("thirdparty/lodash"),
        EventDispatcher      = brackets.getModule("utils/EventDispatcher"),
        Bower                = require("src/bower/Bower"),
        ProjectManager       = require("src/project/ProjectManager"),
        PackageFactory       = require("src/project/PackageFactory"),
        PackageOptions       = require("src/bower/PackageOptions"),
        ConfigurationManager = require("src/configuration/ConfigurationManager"),
        ErrorUtils           = require("src/utils/ErrorUtils");

    var DependencyType = PackageOptions.DependencyType,
        VersionOptions = PackageOptions.VersionOptions;

    var TILDE = "~",
        CARET = "^";

    EventDispatcher.makeEventDispatcher(exports);

    /**
     * @param {string} options
     * @param {number} type
     * @private
     */
    function _getVersion(version, type) {
        var fullVersion;

        if (version && (version.trim() !== "")) {
            switch (type) {
            case VersionOptions.TILDE:
                fullVersion = TILDE + version;
                break;
            case VersionOptions.CARET:
                fullVersion = CARET + version;
                break;
            default:
                fullVersion = version;
            }
        }

        return fullVersion;
    }

    /**
     * @param {string} name
     * @param {string} version
     * @param {number} type
     * @return {string} packageName
     * @private
     */
    function _getPackageVersionToInstall(name, version, type) {
        // prepare package name with version if any
        var packageVersion = _getVersion(version, type),
            packageName = name;

        if (version) {
            packageName += "#" + packageVersion;
        }

        return packageName;
    }

    /**
     * @param {Package} pkg
     * @param {object} data Values to update the package properties.
     *      version {string|null}: Version to update to. If empty, it will update it to the latest version.
     *      versionType {number}: The version type to use, following semver conventions.
     *      type {number}: update the package type: dependency or devDependency.
     * @private
     */
    function _getUpdateDataForPackage(pkg, data) {
        var updateData,
            updateVersion,
            dependencyType;

        if (!data) {
            data = {};
        }

        dependencyType = data.type;

        function addToUpdateData(dataKey, value) {
            if (!updateData) {
                updateData = {};
            }

            updateData[dataKey] = value;
        }

        updateVersion = _getVersion(data.version, data.versionType);

        if (!updateVersion && pkg.latestVersion) {
            // if any specific version was requested, update to the latest available version
            updateVersion = TILDE + pkg.latestVersion;
        }

        // version
        if (updateVersion && (pkg.version !== updateVersion)) {
            addToUpdateData("version", updateVersion);
        }

        // dependency type
        if (PackageOptions.isValidDependencyType(dependencyType) && pkg.dependencyType !== dependencyType) {
            addToUpdateData("dependencyType", dependencyType);
        }

        return updateData;
    }

    /**
     * @param {object} data
     * @private
     */
    function _getInstallOptions(data) {
        var options = {};

        // prepare default values when needed
        if (typeof data.type !== "number") {
            data.type = DependencyType.PRODUCTION;
        }

        if (typeof data.save !== "boolean") {
            data.save = false;
        }

        // setup options
        if (data.type === DependencyType.PRODUCTION) {
            options.save = data.save;
        } else {
            options.saveDev = data.save;
        }

        return options;
    }

    /**
     * Get detailed information about the given package.
     * @param {string} name Package name to get detailed information.
     * @return {$.Deferred}
     */
    function info(name) {
        var deferred = new $.Deferred(),
            config = ConfigurationManager.getConfiguration();

        Bower.info(name, config).then(function (result) {
            var packageInfo = PackageFactory.createInfo(result),
                project = ProjectManager.getProject();

            if (project && project.hasPackage(name)) {
                packageInfo.installedPackage = project.getPackageByName(name);
            }

            deferred.resolve(packageInfo);
        }).fail(function (error) {
            deferred.reject(error);
        });

        return deferred;
    }

    /**
     * Install the given package and udpate the project model.
     * @param {string} name The package name to install.
     * @param {data} options Options to install the package.
     *      version {string|null}: The package version.
     *      versionType {number}: The version type to use, following semver conventions.
     *      type {number}: Specify if the package to install is a dependency or devDependency.
     *      save {boolean}: Save or not the package to the bower.json file.
     * @return {$.Deferred}
     */
    function install(name, data) {
        var deferred = new $.Deferred(),
            config = ConfigurationManager.getConfiguration(),
            project = ProjectManager.getProject(),
            packageName,
            options;

        if (!project) {
            return deferred.reject(ErrorUtils.createError(ErrorUtils.NO_PROJECT));
        }

        if (!data) {
            data = {};
        }

        packageName = _getPackageVersionToInstall(name, data.version, data.versionType);
        options = _getInstallOptions(data);

        // install the given package
        Bower.installPackage(packageName, options, config).then(function (result) {
            var pkg;

            if (result.count !== 0) {
                var pkgs = PackageFactory.createPackages(result.packages);

                // find the direct installed package
                pkg = _.find(pkgs, function (pkgObject) {
                    return (pkgObject.name === name);
                });

                info(name).then(function (packageInfo) {

                    pkg.updateVersionInfo(packageInfo);
                }).always(function () {
                    project.addPackages(pkgs);

                    deferred.resolve(pkg);
                });
            } else {
                // check if it is a previous installed package as a package dependency
                pkg = project.getPackageDependencyByName(name);

                if (pkg) {
                    project.updatePackageDependencyToProject(name);

                    deferred.resolve(pkg);
                } else {
                    deferred.reject(ErrorUtils.createError(ErrorUtils.EINSTALL_NO_PKG_INSTALLED));
                }
            }

        }).fail(function (error) {
            deferred.reject(error);
        });

        return deferred;
    }

    /**
     * Install all the defined packages in the bower.json file.
     * First checks if the bower.json file is available for the
     * current project, if so, it continues with the dependencies
     * installation, otherwhise, it rejects the promise.
     * @return {$.Deferred}
     */
    function installFromBowerJson() {
        var deferred = new $.Deferred(),
            project = ProjectManager.getProject(),
            config;

        if (!project) {
            return deferred.reject(ErrorUtils.createError(ErrorUtils.NO_PROJECT));
        }

        if (!project.hasBowerJson()) {
            return deferred.reject(ErrorUtils.createError(ErrorUtils.NO_BOWER_JSON));
        }

        config = ConfigurationManager.getConfiguration();

        Bower.install(config).then(function (result) {
            var total = result.count,
                installResult = {
                    total: total,
                    installed: [],
                    updated: []
                };

            if (total !== 0) {
                var packagesArray = PackageFactory.createPackages(result.packages),
                    pkgsData = project.addPackages(packagesArray);

                installResult.installed = pkgsData.installed;
                installResult.updated = pkgsData.updated;

                deferred.resolve(installResult);
            } else {
                deferred.resolve(installResult);
            }

        }).fail(function (error) {
            deferred.reject(error);
        });

        return deferred;
    }

    /**
     * Remove extraneous packages according to the bower.json packages definition.
     * @return {$.Deferred}
     */
    function prune() {
        var deferred = new $.Deferred(),
            project = ProjectManager.getProject(),
            config;

        if (!project) {
            return deferred.reject(ErrorUtils.createError(ErrorUtils.NO_PROJECT));
        }

        if (!project.hasBowerJson()) {
            return deferred.reject(ErrorUtils.createError(ErrorUtils.NO_BOWER_JSON));
        }

        config = ConfigurationManager.getConfiguration();

        Bower.prune(config).then(function (uninstalled) {
            var result = project.removePackages(Object.keys(uninstalled));

            deferred.resolve(result);
        }).fail(function (error) {
            deferred.reject(error);
        });

        return deferred;
    }

    /**
     * Uninstall the given package by its name. To force uninstalling the package,
     * true must be passed as the second parameter.
     * @param {string} name Existent package to uninstall.
     * @param {boolean} force Force uninstalling the given package.
     * @return {$.Deferred}
     */
    function uninstall(name, force) {
        var deferred = new $.Deferred(),
            config = ConfigurationManager.getConfiguration(),
            project = ProjectManager.getProject(),
            options = {
                save: true,
                saveDev: true
            };

        if (!project) {
            return deferred.reject(ErrorUtils.createError(ErrorUtils.NO_PROJECT));
        }

        config.force = (typeof force === "boolean") ? force : false;

        Bower.uninstall(name, options, config).then(function (uninstalled) {
            var pkgs = project.removePackages(Object.keys(uninstalled));

            deferred.resolve(pkgs);
        }).fail(function (error) {
            // check if there's a conflict error when uninstalling, in that case
            // parse the data to get an array of packages names in conflict
            if (error.code === ErrorUtils.CONFLICT) {
                var originalError = error.originalError,
                    data = (originalError || originalError.data) ? originalError.data : null,
                    dependants;

                if (data && data.dependants) {
                    dependants = PackageFactory.getPackagesName(data.dependants);
                } else {
                    dependants = [];
                }

                error.dependants = dependants;
            }

            deferred.reject(error);
        });

        return deferred;
    }

    /**
     * Update the given package to the given version if any, otherwise it will update it
     * to the latest available version.
     * @param {string} name Name of the package to update.
     * @param {data} options Options to install the package.
     *      version {string|null}: Version to update to. If empty, it will update it to the latest version.
     *      versionType {number}: The version type to use, following semver conventions.
     *      type {number}: update the package type: dependency or devDependency.
     * @return {$.Deferred}
     */
    function update(name, data) {
        var deferred = new $.Deferred(),
            config = ConfigurationManager.getConfiguration(),
            project = ProjectManager.getProject(),
            pkg,
            bowerJson,
            updateData;

        if (!project) {
            return deferred.reject(ErrorUtils.createError(ErrorUtils.NO_PROJECT));
        }

        // force bower.json to exists before updating
        if (!project.hasBowerJson()) {
            return deferred.reject(ErrorUtils.createError(ErrorUtils.NO_BOWER_JSON));
        }

        pkg = project.getPackageByName(name);
        bowerJson = project.activeBowerJson;

        // check if the selected package exists
        if (!pkg) {
            return deferred.reject(ErrorUtils.createError(ErrorUtils.PKG_NOT_INSTALLED));
        }

        // get package data to update
        updateData = _getUpdateDataForPackage(pkg, data);

        if (!updateData || Object.keys(updateData) === 0) {
            return deferred.reject(ErrorUtils.createError(ErrorUtils.EUPDATE_NO_DATA));
        }

        bowerJson.updatePackageInfo(name, updateData).then(function () {

            return Bower.update(name, config);
        }).then(function (result) {

            if (result.packages) {
                var pkgs = PackageFactory.createPackages(result.packages),
                    updatedPkg;

                // find the direct updated package
                updatedPkg = _.find(pkgs, function (pkgObject) {
                    return (pkgObject.name === name);
                });

                info(name).then(function (packageInfo) {
                    // update the package latestVersion
                    updatedPkg.updateVersionInfo(packageInfo);
                }).always(function () {
                    project.updatePackages(pkgs);

                    deferred.resolve(updatedPkg);
                });
            } else if (updateData.dependencyType !== undefined) {
                // dependencyType was an updated property

                pkg.dependencyType = updateData.dependencyType;

                project.updatePackage(pkg);

                deferred.resolve(pkg);
            } else {

                deferred.reject(ErrorUtils.createError(ErrorUtils.EUPDATE_NO_PKG_UPDATED));
            }
        }).fail(function (error) {

            deferred.reject(error);
        });

        return deferred;
    }

    /**
     * Search the registry for packages using the current configuration.
     * @return {$.Deferred}
     */
    function search() {
        return Bower.search(ConfigurationManager.getConfiguration());
    }

    /**
     * Get the cached packages using the current configuration.
     * @return {$.Deferred}
     */
    function listCache() {
        return Bower.listCache(ConfigurationManager.getConfiguration());
    }

    /**
     * Get the current installed packages and updates if they have, using
     * the current configuration.
     * @param {boolean=} offline True if offline mode is enabled, otherwhise false.
     * @return {$.Deferred}
     */
    function list(offline) {
        var config = ConfigurationManager.getConfiguration();

        if (typeof offline === "boolean") {
            config.offline = offline;
        }

        return Bower.list(config);
    }

    exports.install                 = install;
    exports.uninstall               = uninstall;
    exports.installFromBowerJson    = installFromBowerJson;
    exports.prune                   = prune;
    exports.update                  = update;
    exports.info                    = info;
    exports.search                  = search;
    exports.listCache               = listCache;
    exports.list                    = list;
});
