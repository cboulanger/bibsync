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

  // expose source files only during development
  if( config.general.mode == "development" ){
    router.use(express.static('.'));
  }
  
  // expose temp dir for files generated on-the-fly
  router.use(express.static('tmp'));

  // socket.io
  var server = require('http').Server(router);
  var io     = require('socket.io')(server);
  io.on('connection', function(socket){
    console.debug('User connected');
    socket.on('disconnect', function(){
      console.debug('User disconnected');
    });
  });
  
  /**
   * Socket
   */
  var socket = null; 
  io.on('connection', function(s){
    socket = s;
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
    getIo : function(){
      return io;
    },
    
    /**
     * Returns a promise resolving with the socket.io object
     * @return {Promise}
     */    
    getSocket : function(){
      if (socket) return Promise.resolve(socket);
      return new Promise((resolve)=>{
        io.on("connection",resolve);
      });
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
     * Returns the path to a temporary file
     * @param {String|undefined} Optional file extension
     * @return {String}
     */
    getTempFile : function(ext){
      return require("tempfile")(ext||".tmp");
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
        progress : percent||0,
        message: message,
        newLogText : newLogText || ""
      };
      if(percent === 0) params.logContent="";
      sandbox.getSocket().then((socket)=>{
        socket.emit("progress.show", params);
      });
    },

    /**
     * hides the progress widget
     */
    hideProgress : function(){
      sandbox.getSocket().then((socket)=>{
        socket.emit("progress.show", false);
      });
    },

    /**
     * Shows a file progress widget on the server
     * @param  {Integer} percent
     * @param  {String} message    The message below the progress meter
     * @return void
     */
    showFileProgress : function (percent,message){
      var params = {
        progress : percent||0,
        message: message
      };
      if(percent === 0) params.logContent="";
      sandbox.getSocket().then((socket)=>{
        socket.emit("fileprogress.show", params);
      });
    },

    /**
     * Hides the file progress widget
     */
    hideFileProgress : function(){
      sandbox.getSocket().then((socket)=>{
        socket.emit("fileprogress.show", false);
      });
    },
    
    /**
     * Prompts the user with a message and asks for an input
     * @param {String} msg Message
     * @return {Promise}
     */
    promptUser : function( msg ){
      return this._clientDialog("promptUser", msg);
    },
     
    clientAlert : function( msg ){
      return this._clientDialog("alert", msg);
    },
    
    clientError : function( msg ){
      console.debug(msg);
      return this._clientDialog("error", msg);
    },
     
    _clientDialog : function(type, msg) {
      return new Promise((resolve)=>{
        this.getSocket().then((socket)=>{
          socket.emit(type, msg, (response)=>{
            resolve(response);
          });  
        });
      });
    },

    /**
     * Call a RPC method on the client
     * @param  {String} eventName The name of the event bound to the method
     * @param  {Object} args   A map of named Arguments
     * @return {Promise} A promise resolving with the result of the method
     */
    callClientMethod : function( methodname, args){
      return new Promise(function(resolve, reject) {
        io.on('connection', function(socket){
          socket.emit( eventName, args, function(result){
            if( result && typeof result == "object" && result.error !== undefined ){
              reject(result.error);
            } else {
              resolve(result);
            }
          });
        });
      });
    },

    /**
     * Binds an event name to a class method
     * @param  {String} eventName The name of the event bound to the method
     * @param  {function} method The method function
     * @return {void}
     */
    bindRpcMethod : function( eventName, method ){
      io.on('connection', function (socket) {
        socket.on(eventName, function (args, done) {
          var result = method(args);
          if ( result instanceof Promise ) {
            result.then(done).catch(function(e){
              done({error: ""+e});
            });
          } else {
            throw new Error("RPC methods must return a promise!");
          }
        });
      });
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
      return function( err ){
        global.console.error(err);
        res.status(500).send( err.message );
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
  

  sandbox.bindRpcMethod("bibsync.copy", services.copyFolder );

  // tests
  sandbox.bindRpcMethod("test-success",function(args){
    return Promise.resolve("RPC test successful");
  });
  sandbox.bindRpcMethod("bibsync.test",function(args){
    return services.extractRange(args);
  });
  var pdfeditor =  require("./service/pdfeditor")(sandbox);
  sandbox.bindRpcMethod("bibsync.extractChapters",function(info){
    return pdfeditor.createChaptersFromToc(info);
  });
  


  // start server when all plugins have been loaded
  this.on('afterFinished', function () {
    var port = process.env.PORT||3000;
    server.listen(port, function () {
      console.info('BibSync server listening on http://localhost:'+port);
    });
  });



  // plugin is initiatized
  done(null, sandbox);
};
