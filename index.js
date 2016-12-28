
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

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

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var path = require('path');

var Store = function (_BaseStore) {
    _inherits(Store, _BaseStore);

    function Store() {
        var storageConfig = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

        _classCallCheck(this, Store);

        var _this = _possibleConstructorReturn(this, (Store.__proto__ || Object.getPrototypeOf(Store)).call(this, storageConfig));

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

        _this.nextStorageInstance = new NextStorage(_config2.default.storage[storageConfig.nextStorage]);
        return _this;
    }

    _createClass(Store, [{
        key: 'save',
        value: function save(file, targetDir) {

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


                            nextStorageInstance.save(newFileObject, targetDir).then(function () {
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
    }, {
        key: 'exists',
        value: function exists() {
            return this.nextStorageInstance.exists.apply(this.nextStorageInstance, arguments);
        }
    }, {
        key: 'serve',
        value: function serve() {
            return this.nextStorageInstance.serve.apply(this.nextStorageInstance, arguments);
        }
    }, {
        key: 'delete',
        value: function _delete() {
            return this.nextStorageInstance.delete.apply(this.nextStorageInstance, arguments);
        }
    }]);

    return Store;
}(_base2.default);

exports.default = Store;
module.exports = exports['default'];
