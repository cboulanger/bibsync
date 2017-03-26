var express       = require('express');
var bodyParser    = require('body-parser');
var Debug         = require('console-debug');

/**
 * BibSync plugin - this is the main application.
 * @param  {Function} done Callback function to be called when plugin
 * is configured.
 * @return {void}
 */
module.exports = function bibsync(datastore,done)
{
  // config object
  var config = require("../../config");

  // custom console
  var console = new Debug(config.console[config.general.mode]);

  // initialize datasource
  datastore.init(config,console);

  // express with api server and static file server
  var router = express();
  router.use(bodyParser.urlencoded({ extended: false }));
  router.use(bodyParser.json());
  router.use(express.static('html/bibSync'));
  router.use(express.static('.')); // only for development

  // socket.io
  var server = require('http').Server(router);
  var io     = require('socket.io')(server);
  io.on('connection', function(socket){
    console.debug('User connected');
    socket.on('disconnect', function(){
      console.debug('User disconnected');
    });
  });

  // application apis
  var apis = {};

  /*
    Sandbox: A secure API for the other plugins
   */
  var sandbox = {

    /**
     * The configuration object
     * @type {Object}
     */
    getConfig : function(){
      return config;
    },

    /**
     * The express router
     * @return {Object}
     */
    getRouter : function()
    {
      return router;
    },

    /**
     * Returns the socket.io object
     * @return {Object}
     */
    getSocket : function()
    {
      return io;
    },

    /**
     * Return a pimped console object that includes a debug() and info() method.
     * @return {Object} An object with the methods log(), warn(), info(), debug()
     */
    getConsole : function(){
      return console;
    },

    /**
     * Returns an object that exposes the datastore plugin API
     * @return {Object}
     */
    getDatastore : function(){
      return datastore;
    },

    /**
     * Add an application API, if it is enabled in the config
     * @param  {String} name The name of the api (the name of the plugin)
     * @param  {Object} api  An object exposing the API
     * @return {void}
     */
    addApi : function(name,api){
      if( apis[name] !== undefined ){
        console.warn("API " + name + " is already defined.");
      }
      else if( ! config[name] ){
        console.warn("API " + name + " has no config section defined.");
      }
      if( config[name].enabled ){
        console.log("Enabled " +  config[name].name + " API.");
        apis[name] = api;
      } else {
        console.log("Disabled " +  config[name].name + " API.");
      }
    },

    /**
     * Returns the APIs exposed by the plugins
     * @return {Object} A map, keys being the names of the APIs, the values
     * being the API objects
     */
    getEnabledApis : function(){
      return apis;
    },

    /**
     * Shows a progress widget on the server
     * @param  {Integer} percent
     * @param  {String} message    The message below the progress meter
     * @param  {String} newLogText Text to be written to the log of widget
     * @return void
     */
    showProgress : function (percent,message,newLogText){
      var params = {
        progress : percent,
        message: message,
        newLogText : newLogText || ""
      };
      if(percent === 0) params.logContent="";
      io.emit("progress.show", params);
    },

    /**
     * Function used when the service completed succesfully
     * @param  {Object}   res The express response object
     * @return {Function} A function that converts the result into JSON
     * and returns it to the client with the express response object
     */
     success : function( res ){
      return function( result ){
        res.json( result );
      };
    },

    /**
     * Factory function that returns the function for the .catch() method
     * of a promise
     * @param  {Object}   res The express response object
     * @return {Function} A function that sends a HTTP error response
     */
    fail: function(res){
      return function( error ){
        console.warn(""+err);
        res.status(500).send(""+err);
      };
    },

    /**
     * Return the global dictionary object initialized with the local one.
     * @param  {Object} localDictionary The local dictionary object
     * @return {Object} The global dictionary object
     */
    getGlobalDictionary : function( localDictionary )
    {
      return require('./dictionary')(localDictionary);
    }
  };

  /*
    bibsync services
   */
  var services = require("./services")(sandbox);

  router.get('/libraries', services.libraries);

  // TODO: long URL makes no sense, post info instead
  router.get(
    '/sync/:sourceApplication/:sourceType/:sourceId/:sourceCollectionKey/'+
    'to/:targetApplication/:targetType/:targetId/:targetCollectionKey/:action',
    services.startSync
  );
  router.get(
    '/copy/:sourceApplication/:sourceType/:sourceId/:sourceCollectionKey/'+
    'to/:targetApplication/:targetType/:targetId/:targetCollectionKey/',
    services.copyFolder
  );

  // start server when all plugins have been loaded
  this.on('afterFinished', function () {
    server.listen(3000, function () {
      console.info('BibSync server listening on http://localhost:3000 ...');
    });
  });

  // plugin is initiatized
  done(null, sandbox);
};
