// Copyright (C) 2016 Glamping Hub (https://glampinghub.com)
// License: BSD 3-Clause

/*jslint node: true, single: true, this: true */

'use strict';

var path = require('path');
var fs = require('fs');
var util = require('util');
var BaseStore = require('../../../core/server/storage/base');
var config = require('../../../core/server/config');
var Promise = require('bluebird');
var tmp = require('tmp');
var sharp = require('sharp');
var imagemin = require('imagemin');
var imageminGifsicle = require('imagemin-gifsicle');
var imageminJpegtran = require('imagemin-jpegtran');
var imageminOptipng = require('imagemin-optipng');


tmp.setGracefulCleanup();

function MinifyStore(config) {
    BaseStore.call(this);
    this.constructor(config);
}

util.inherits(MinifyStore, BaseStore);

MinifyStore.prototype.constructor = function (storageConfig) {
    // Configure next storage instance
    if (!storageConfig || !storageConfig.hasOwnProperty('nextStorage')) {
        throw 'You must configure the "nextStorage" property for the "Ghost Minified Storage"!';
    }
    var NextStorage;
    try {
        // CASE: load adapter from custom path  (.../content/storage)
        NextStorage = require(config.paths.storagePath.custom + storageConfig.nextStorage);
    } catch (err) {
        // CASE: only throw error if module does exist
        if (err.code !== 'MODULE_NOT_FOUND') {
            throw err.message;
        }

        // CASE: load adapter from default path
        NextStorage = require(config.paths.storagePath.default + storageConfig.nextStorage);
    }
    this.nextStorageInstance = new NextStorage(config.storage[storageConfig.nextStorage]);

    // Configure each property
    var that = this;
    [
        {name: 'saveOriginalFile', defaultValue: 'true'},
        {name: 'deleteOriginalFile', defaultValue: true},
        {name: 'maxWidth', defaultValue: false},
        {name: 'maxHeight', defaultValue: false},
        {name: 'regExWithoutSuffix', defaultValue: /^.+(\.[^\.]+)$/},
        {name: 'regExResultWithoutSuffix', defaultValue: '$1$2'},
        {name: 'regExWithSuffix', defaultValue: /^.+_resized(\.[^\.]+)$/},
        {name: 'regExResultWithSuffix', defaultValue: '$1_resized$2'}
    ].forEach(function (property) {
        that[property.name] = storageConfig.hasOwnProperty(property.name)
            ? storageConfig[property.name]
            : property.defaultValue;
    });
};

MinifyStore.prototype.save = function (file, targetDir) {
    /* file =
    < { fieldname: 'uploadimage',
    <   originalname: 'example.png',
    <   encoding: '7bit',
    <   mimetype: 'image/png',
    <   destination: '/tmp',
    <   filename: '67cc4b2c69cbf07d5839fbdb8ec76c44',
    <   path: '/tmp/67cc4b2c69cbf07d5839fbdb8ec76c44',
    <   size: 371703,
    <   name: 'example.png',
    <   type: 'image/png',
    <   context: { user: 1, client: null } }
    */

    var that = this;
    var resizeImageIfNeeds = function (src, resolve, reject) {
        try {
            // Resize image
            var buffer = sharp(src)
                .png({
                    progressive: true,
                    compressionLevel: 9
                })
                .jpeg({
                    quality: 80,
                    progressive: true,
                    optimizeScans: true
                });

            if (that.maxWidth || that.maxHeight) {
                buffer = buffer.resize(1024, 1024).max();
            }
            buffer.toBuffer(function (err, buffer, info) {
                if (err) {
                    throw err;
                }
                resolve(buffer, info);
            });
        } catch (e) {
            reject(e);
        }
    };
    var minifyImage = function (buffer, resolve, reject) {
        tmp.file(function (err, temporalFilePath, ignore, cleanupCallback) {
            if (err) {
                throw err;
            }

            try {
                imagemin.buffer(buffer, {
                    plugins: [
                        imageminGifsicle(),
                        imageminJpegtran(),
                        imageminOptipng()
                    ]
                }).then(function (buffer) {  // files = [{data: <Buffer 89 50 4e …>, path: 'build/images/foo.jpg'}, …]
                    fs.writeFile(temporalFilePath, buffer, function (err) {
                        if (err) {
                            throw err;
                        }

                        var newFileObject = JSON.parse(JSON.stringify(file)); // JS clone stuff
                        newFileObject.originalname = file.originalname.replace(that.regExWithoutSuffix, that.regExResultWithSuffix);
                        newFileObject.filename = path.basename(temporalFilePath);
                        newFileObject.path = temporalFilePath;
                        newFileObject.size = buffer.length;

                        resolve(newFileObject)
                            .then(cleanupCallback, cleanupCallback)
                            .catch(cleanupCallback);
                    });
                });
            } catch (e) {
                cleanupCallback();
                reject(e);
            }
        });
    };

    return new Promise(function (resolve, reject) {
        // Save original image if needs
        if (that.saveOriginalFile) {
            that.nextStorageInstance.save(file, targetDir);
        }

        resizeImageIfNeeds(file.path, function (buffer) {
            minifyImage(buffer, function (file) {
                return that.nextStorageInstance
                    .save(file, targetDir)
                    .then(function (file2) {
                        resolve(file2);
                    });
            }, reject);
        }, reject);
    });
};

MinifyStore.prototype.exists = function () {
    return this.nextStorageInstance.exists.apply(this.nextStorageInstance, arguments);
};

MinifyStore.prototype.serve = function () {
    return this.nextStorageInstance.serve.apply(this.nextStorageInstance, arguments);
};

MinifyStore.prototype.delete = function (fileName, targetDir) {
    var promises = [this.nextStorageInstance.delete.apply(this.nextStorageInstance, arguments)];

    // Delete original image if needs
    if (this.deleteOriginalFile) {
        promises.push(this.nextStorageInstance.delete(fileName.replace(this.regExWithSuffix, this.regExResultWithoutSuffix), targetDir));
    }

    return Promise.all(promises);
};

module.exports = MinifyStore;
