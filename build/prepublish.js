var path = require('path');
var webpack = require('webpack');
var fs = require('fs-extra')
var Promise = require('bluebird');

var ensureDir = Promise.promisify(fs.ensureDir);
var emptyDir = Promise.promisify(fs.emptyDir);
var copy = Promise.promisify(fs.copy);
var p_webpack = Promise.promisify(webpack);

var pDag = require('../index.js');
// using our own lib to build
pDag.link({
  ensureJs: [function () {
    return ensureDir(path.join(__dirname, "../js/"));
  }],
  clean: ['ensureJs',function () {
    return emptyDir(path.join(__dirname, "../js/"));
  }],
  ensuredRelease: ['clean', function () {
    return ensureDir(path.join(__dirname, "../js/browser"));
  }],
  copiedRelease: ['ensuredRelease', function () {
    return copy(path.join(__dirname, "../index.js"), path.join(__dirname, '../js/release/promise-dag.js'));
  }],
  builtBrowser: ['clean', function () {
    return Promise.all([
      p_webpack({
        entry: {
          main: path.join(__dirname, "../index.js")
        },
        output: {
          path: path.join(__dirname, "../js/browser"),
          filename: "promise-dag.js"
        },
        module: {
          loaders: []
        },
        plugins: []
      }),
      p_webpack({
        entry: {
          main: path.join(__dirname, "../build/browser.js")
        },
        output: {
          path: path.join(__dirname, "../js/browser"),
          sourceMapFilename: "[file].map",
          filename: "promise-dag.min.js"
        },
        module: {
          loaders: []
        },
        plugins: [new webpack.optimize.UglifyJsPlugin({})],
        devtool: '#source-map'
      })
    ]);
  }],
  done: ['copiedRelease','builtBrowser', function () {
    return 'ok';
  }]
},['done']).done.then(function () {
    console.log('done');
  }, function (err) {
    console.error(err);
  });

