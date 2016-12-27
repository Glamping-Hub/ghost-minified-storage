/**
/* Copyright (C) 2016 Glamping Hub (https://glampinghub.com)
/* License: BSD 3-Clause
*/
import path from 'path';
import BaseStore from '../../../core/server/storage/base'
import config from '../../../core/server/config'
import Promise from 'bluebird'
import tmp from 'tmp'
import sharp from 'sharp';
import imagemin from 'imagemin'
import imageminGifsicle from 'imagemin-gifsicle'
import imageminJpegtran from 'imagemin-jpegtran'
import imageminOptipng from 'imagemin-optipng'

class Store extends BaseStore {
    constructor(storageConfig = {}) {
        super(storageConfig)

        if (!storageConfig.hasOwnProperty('nextStorage')) {
            throw 'You must configure the "nextStorage" property for the "Ghost Minified Storage"!';
        }

        // CASE: load adapter from custom path  (.../content/storage)
        var NextStorage = require(config.paths.storagePath.custom + storageConfig.nextStorage)
        this.nextStorageInstance = new NextStorage(config.storage[storageConfig.nextStorage])
    }

    save(file, targetDir) {
        var that = this
        return new Promise((resolve, reject) => {
            tmp.dir((err, path, cleanupCallback) => {
                if (err) {
                    throw err
                }

                //TODO original image hash
                var hash = 'prehash_'
                //TODO Save original image if needs

                // Resize image
                sharp(file.name)
                    .resize(1024, 1024)
                    .max()
                    .toFile(path.join(path, hash + file.name), (err, info) => {

                        // Minify image
                        imagemin([path.join(path, hash + file.name)], path, {
                            plugins: [
                                imageminGifsicle(),
                                imageminJpegtran(),
                                imageminOptipng()
                            ]
                        }).then(files => {

                            // console.log(files);
                            //   => [{data: <Buffer 89 50 4e …>, path: 'build/images/foo.jpg'}, …]
                            var file = files[0]

                            resolve(that.nextStorageInstance.save(file, targetDir))
                        }).finally(() => cleanupCallback())
                    })
            })
        })
    }

    exists(filename) {
        return this.nextStorageInstance.exists(filename)
    }

    serve(options) {
        return this.nextStorageInstance.serve(options)
    }

    delete(fileName, targetDir) {
        //TODO Delete original image if needs
        return this.nextStorageInstance.delete(fileName, targetDir)
    }
}

export default Store