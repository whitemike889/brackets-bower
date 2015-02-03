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
/*global define, brackets */

define(function (require, exports, module) {
    "use strict";

    var PreferencesManager = brackets.getModule("preferences/PreferencesManager"),
        preferences        = PreferencesManager.getExtensionPrefs("brackets-bower");

    var settings = {
        RELOAD_REGISTRY_TIME: "reloadRegistryTime",
        QUICK_INSTALL_SAVE: "quickInstallSavePackages",
        EXTENSION_VISIBLE: "show"
    };

    var defaults = {
        reloadRegistryTime: 600000,
        quickInstallSavePackages: true,
        show: false
    };

    function _init() {
        preferences.definePreference(settings.RELOAD_REGISTRY_TIME, "number", defaults.reloadRegistryTime);
        preferences.definePreference(settings.QUICK_INSTALL_SAVE, "boolean", defaults.quickInstallSavePackages);
        preferences.definePreference(settings.EXTENSION_VISIBLE, "boolean", defaults.show);
    }

    function get(key) {
        return preferences.get(key);
    }

    function set(key, value) {
        preferences.set(key, value);
        preferences.save();
    }

    function getDefaults() {
        return defaults;
    }

    function getDefaultBySetting(setting) {
        return defaults[setting];
    }

    _init();

    exports.set                 = set;
    exports.get                 = get;
    exports.settings            = settings;
    exports.getDefaults         = getDefaults;
    exports.getDefaultBySetting = getDefaultBySetting;
});