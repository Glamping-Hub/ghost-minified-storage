// Copyright (C) 2016 Glamping Hub (https://glampinghub.com)
// License: BSD 3-Clause

/*jslint node: true, es6: true */
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
        var that = this;

        return new Promise(function (resolve, reject) {
            tmp.dir(function (err, path, cleanupCallback) {
                if (err) {
                    throw err
                }

                //TODO original image hash
                var hash = 'prehash_';
                //TODO Save original image if needs

                // Resize image
                sharp(file.name)
                    .resize(1024, 1024)
                    .max()
                    .toFile(path.join(path, hash + file.name), function (err, info) {

                        // Minify image
                        imagemin([path.join(path, hash + file.name)], path, {
                            plugins: [
                                imageminGifsicle(),
                                imageminJpegtran(),
                                imageminOptipng()
                            ]
                        }).then(function (files) {

                            // console.log(files);
                            //   => [{data: <Buffer 89 50 4e …>, path: 'build/images/foo.jpg'}, …]
                            var file = files[0];

                            resolve(that.nextStorageInstance.save(file, targetDir));
                        }).finally(function () {
                            //TODO
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
