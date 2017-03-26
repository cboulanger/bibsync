var glob            = require('glob');
var pluginable      = require('pluginable');

// plugin management provided by
// https://github.com/confuser/node-pluginable

// Promise shimmings
require('promise.prototype.finally').shim();
Promise.waterfall = require('p-waterfall');
Promise.series    = require('p-series');

// load plugins
glob('./plugin/**/plugin.js', {realpath:true}, function (error, files) {
  if( error) throw error;
  var pluginLoader = pluginable(files);
  pluginLoader.load(function (error) {
    if (error) throw(error);
  });
});
