var pluginable      = require('pluginable'); // plugin management https://github.com/confuser/node-pluginable
var glob            = require('glob');

// load plugins
glob('./plugin/**/plugin.js', {realpath:true}, function (error, files) {
  if( error) throw error;
  var pluginLoader = pluginable(files);
  pluginLoader.load(function (error) {
    if (error) throw(error);
    try{
      //https://github.com/sindresorhus/opn
      //require('opn')('http://localhost:3000/source',{app: 'google chrome'});
    } catch(e) {
      console.log("Could not open browser:" + e);
    }
  });
});
