// Copyright (C) 2016 Glamping Hub (https://glampinghub.com)
// License: BSD 3-Clause

/*jslint node: true, single: true, this: true */

'use strict';

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

        // CASE: either storage[storageChoice] is already set or why check for in the default storage path
        NextStorage = require(config.paths.storagePath.default + storageConfig.nextStorage);
    }

    this.nextStorageInstance = new NextStorage(config.storage[storageConfig.nextStorage]);
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

    var nextStorageInstance = this.nextStorageInstance;

    return new Promise(function (resolve, reject) {
        //TODO Save original image if needs

        tmp.file(function (err, tmpFilePath, ignore, cleanupCallback) {
            if (err) {
                throw err;
            }

            // Resize image
            sharp(file.path)
                .resize(1024, 1024)
                .max()
                .toFile(tmpFilePath, function (err, ignore) {
                    if (err) {
                        throw err;
                    }

                    // Minify image
                    //FIXME: Remove hardcoded "/tmp/"
                    imagemin([tmpFilePath], '/tmp/', {
                        plugins: [
                            imageminGifsicle(),
                            imageminJpegtran(),
                            imageminOptipng()
                        ]
                    }).then(function (files) {
                        // console.log(files);
                        //   => [{data: <Buffer 89 50 4e …>, path: 'build/images/foo.jpg'}, …]

                        var newFileObject = JSON.parse(JSON.stringify(file));
                        //newFileObject.filename = '';
                        newFileObject.path = files[0].path;
                        //delete newFileObject.size;

                        nextStorageInstance
                            .save(newFileObject, targetDir)
                            .then(function (image) {
                                resolve(image);
                                cleanupCallback();
                            });
                    }).catch(function (error) {
                        reject(error);
                        cleanupCallback();
                    });
                });
        });
    });
};

MinifyStore.prototype.exists = function () {
    return this.nextStorageInstance.exists.apply(this.nextStorageInstance, arguments);
};

MinifyStore.prototype.serve = function () {
    return this.nextStorageInstance.serve.apply(this.nextStorageInstance, arguments);
};

MinifyStore.prototype.delete = function () {
    //TODO Delete original image if needs
    return this.nextStorageInstance.delete.apply(this.nextStorageInstance, arguments);
};

module.exports = MinifyStore;
