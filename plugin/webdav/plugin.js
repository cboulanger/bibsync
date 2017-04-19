var request     = require("request");
var fs          = require('fs');
var unzip       = require('unzip');
var tempfile    = require('tempfile');
var fstream     = require('fstream');
var mime        = require('mime');

/**
 * WebDAV file store plugin
 *
 * @param  {Function} done Callback function to be called when plugin
 * is configured.
 * @return {void}
 */
module.exports = function webdav(bibsync,done){
  var sandbox   = bibsync;
  var console   = sandbox.getConsole();
  var config    = sandbox.getConfig();


  function missingParameter(name){
    throw new Error("Missing Parameter "+name);
  }

  var api ={

    /**
     * Returns the options map for the Request executable function
     * @param  {String} name Name of the WebDAV server in the configuration
     * @param  {String} remotepath The relative path of the file from the WebDAV root
     * @return {Object}
     */
    getRequestOptions : function( name, remotepath )
    {
      try {
        var accessInfo = config[name].storage.webdav;
        var url      = accessInfo. url      || missingParameter("url");
        var user     = accessInfo. user     || missingParameter("user");
        var password = accessInfo.password  || missingParameter("password");
        return {
          url: [ url, remotepath].join("/"),
          auth: {
              username: user,
              password: password
          },
          headers : []
        };
      } catch(e) {
        throw new Error("Library " + name + " has no valid WebDAV storage information:" + e);
      }
    },

    /**
     * Returns a ReadStream from the remote
     * @param  {String} name       Name of the WebDAV server in the configuration
     * @param  {String} remotepath Relative path to the file from the server root
     * @return {ReadStream}
     */
    getDownloadStream : function(name, remotepath){
      var filename = remotepath;//TODO
      var options = getRequestOptions( name, remotepath );
      var found = false;
      var bytes=0, filesize=0;

      function onError(err){
        console.error(""+err);
        throw err;
      }

      return request.get(options)
      .on("error", onError)
      .on('response', function(response) {
        switch( response.statusCode ){
          case 404:
          console.warn("Remote file does not exist.");
          return resolve( null );
          case 200:
          filesize = response.headers['content-length'];
          console.debug("File found.");
          return;
          default:
          console.warn("Got HTTP response " + response.statusCode + ": " + response.headers);
          return;
        }
      })
      .on("data",function(chunk){
        bytes += chunk.length;
        sandbox.showProgress(bytes/filesize*100,"Downloading "+filename);
        //console.debug("Sent " +  bytes + " of " + uploadSize + " bytes of data.");
      });
    },


    /**
     * Returns a WriteStream in which a ReadStream can be piped into to upload
     * the file into the storage
     * @param  {String} name       Symbolic name of WebDAV server
     * @param  {String} localpath  absolute or relative path to loca file
     * @param  {String} remotepath Relative path to remote file
     * @return {Stream}
     */
    getUploadStream : function(name, localpath, remotepath)
    {
      var filename = remotepath; // TODO
      var options = getRequestOptions( name, remotepath );
      var uploadSize = fs.statSync(localpath).size;
      options.headers = {
        "Content-Type"   : mime.lookup(localpath),
        "Content-Length" : uploadSize
      };
      var bytes = 0;
      var writeStream = request.post(options)
      .on("error", cleanupAndReject )
      .on('response', function(response) {
        switch( response.statusCode ){
          case 201:
          case 204:
          console.debug("Upload completed. Bytes written: " + bytes);
          fs.unlinkSync(path);
          return resolve(uploadConfig.uploadKey);
          default:
          err = "Http Error " + response.statusCode + ": " + response.headers;
          cleanupAndReject( err );
        }
      })
      .on("data",function(chunk){
        bytes += chunk.length;
        sandbox.showProgress(bytes/uploadSize*100,"Uploading "+ filename );
        //console.debug("Sent " +  bytes + " of " + uploadSize + " bytes of data.");
      });
    },

    /**
     * Uploads the given local file to the server with the given name.
     * @param  {String} name      [description]
     * @param  {String} localpath [description]
     * @return {Promise} A promise that resolves when the upload is done
     */
    upload : function( name, localpath ){
      throw new Error("Not implemente");
    },

    /**
     * Downloads the given remote file and returns the path to a temporary file
     * @param  {String} name       Symbolic name of server
     * @param  {String} remotepath [description]
     * @return {Promise} A Promise that resolves with the path to the local file
     */
    download : function(name, remotepath){
      return new Promise(function(resolve, reject) {
        var localfile = tempfile();
        var writeStream = fs.createWriteStream(localfile);
        var readStream  = this.getDownloadStream(name,remotepath);
        readStream.pipe(writeStream)
        .on("error",reject)
        .on("close",function(){
          resolve(localfile);
        });
      });
    }
  };

  console.debug('Loaded WebDAV plugin.');
  done(null,api);
};
