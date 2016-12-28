

'use strict';

var _util = require('util');

var _util2 = _interopRequireDefault(_util);

var _base = require('../../../core/server/storage/base');

var _base2 = _interopRequireDefault(_base);

var _config = require('../../../core/server/config');

var _config2 = _interopRequireDefault(_config);

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _tmp = require('tmp');

var _tmp2 = _interopRequireDefault(_tmp);

var _sharp = require('sharp');

var _sharp2 = _interopRequireDefault(_sharp);

var _imagemin = require('imagemin');

var _imagemin2 = _interopRequireDefault(_imagemin);

var _imageminGifsicle = require('imagemin-gifsicle');

var _imageminGifsicle2 = _interopRequireDefault(_imageminGifsicle);

var _imageminJpegtran = require('imagemin-jpegtran');

var _imageminJpegtran2 = _interopRequireDefault(_imageminJpegtran);

var _imageminOptipng = require('imagemin-optipng');

var _imageminOptipng2 = _interopRequireDefault(_imageminOptipng);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

_tmp2.default.setGracefulCleanup();

function MinifyStore(config) {
    _base2.default.call(this);
    this.constructor(config);
}

_util2.default.inherits(MinifyStore, _base2.default);

MinifyStore.prototype.constructor = function () {
    var storageConfig = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    if (!storageConfig.hasOwnProperty('nextStorage')) {
        throw 'You must configure the "nextStorage" property for the "Ghost Minified Storage"!';
    }

    var NextStorage;

    try {
        NextStorage = require(_config2.default.paths.storagePath.custom + storageConfig.nextStorage);
    } catch (err) {
        if (err.code !== 'MODULE_NOT_FOUND') {
            throw err.message;
        }

        NextStorage = require(_config2.default.paths.storagePath.default + storageConfig.nextStorage);
    }

    this.nextStorageInstance = new NextStorage(_config2.default.storage[storageConfig.nextStorage]);
};

MinifyStore.prototype.save = function (file, targetDir) {

    var nextStorageInstance = this.nextStorageInstance;

    return new _bluebird2.default(function (resolve, reject) {

        _tmp2.default.file(function (err, tmpFilePath, fd, cleanupCallback) {
            (0, _sharp2.default)(file.path).resize(1024, 1024).max().toFile(tmpFilePath, function (err, info) {
                if (err) {
                    throw err;
                }

                (0, _imagemin2.default)([tmpFilePath], '/tmp/', {
                    plugins: [(0, _imageminGifsicle2.default)(), (0, _imageminJpegtran2.default)(), (0, _imageminOptipng2.default)()]
                }).then(function (files) {

                    var newFileObject = JSON.parse(JSON.stringify(file));

                    newFileObject.path = files[0].path;


                    nextStorageInstance.save(newFileObject, targetDir).then(function (image) {
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
    return this.nextStorageInstance.delete.apply(this.nextStorageInstance, arguments);
};

module.exports = MinifyStore;
