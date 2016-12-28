// Copyright (C) 2016 Glamping Hub (https://glampinghub.com)
// License: BSD 3-Clause

/*jslint node: true, es6: true, single: true */
/*global */

import path from 'path';
import BaseStore from '../../../core/server/storage/base';
import config from '../../../core/server/config';
import Promise from 'bluebird';
import tmp from 'tmp';
import sharp from 'sharp';
import imagemin from 'imagemin';
import imageminGifsicle from 'imagemin-gifsicle';
import imageminJpegtran from 'imagemin-jpegtran';
import imageminOptipng from 'imagemin-optipng';


class Store extends BaseStore {
    constructor (storageConfig = {}) {
        super(storageConfig);

        if (!storageConfig.hasOwnProperty('nextStorage')) {
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
    }

    save (file, targetDir) {
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

            tmp.file(function (err, tmpFilePath, fd, cleanupCallback) {
                // Resize image
                sharp(file.path)
                    .resize(1024, 1024)
                    .max()
                    .toFile(tmpFilePath, function (err, info) {
                        if (err) { throw err; }

                        // Minify image
                        imagemin([tmpFilePath], '', {
                            plugins: [
                                imageminGifsicle(),
                                imageminJpegtran(),
                                imageminOptipng()
                            ]
                        }).then(function (files) {
                            // console.log(files);
                            //   => [{data: <Buffer 89 50 4e …>, path: 'build/images/foo.jpg'}, …]
                            var minifiedFile = files[0];

                            nextStorageInstance
                                .save({ path: minifiedFile.path }, targetDir)
                                .then(function () {
                                    resolve();
                                    cleanupCallback();
                                });
                        }).catch(function (error) {
                            reject(error);
                            cleanupCallback();
                        });
                    });
            });
        });
    }

    exists (filename) {
        return this.nextStorageInstance.exists(filename);
    }

    serve (options) {
        return this.nextStorageInstance.serve(options);
    }

    delete (fileName, targetDir) {
        //TODO Delete original image if needs
        return this.nextStorageInstance.delete(fileName, targetDir);
    }
}

export default Store;
