var glob            = require('glob');
var pluginable      = require('pluginable');

// load plugins
glob('./plugin/**/plugin.js', {realpath:true}, function (error, files) {
  var pluginLoader = pluginable(files);
  pluginLoader.load(function (error) {
    if(error)console.log(error);
    console.log('Plugins loaded');
  });
});
