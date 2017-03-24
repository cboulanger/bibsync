var glob            = require('glob');
var pluginable      = require('pluginable');
var config          = require('./config');

// plugin management provided by
// https://github.com/confuser/node-pluginable
//

// load custom console
var console = config.getConsole();

// load plugins
glob('./plugin/**/plugin.js', {realpath:true}, function (error, files) {
  var pluginLoader = pluginable(files);
  pluginLoader.load(function (error) {
    if (error) return console.warn(error);
    config.debug('Plugins loaded.');
  });
});
