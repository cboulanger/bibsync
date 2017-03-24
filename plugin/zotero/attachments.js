var request     = require("request");
var fs          = require('fs');
var unzip       = require('unzip');
var tempfile    = require('tempfile');
var fstream     = require('fstream');
var config      = require('../../config');

// load custom console
var console = config.getConsole();

module.exports = {

  /**
   * Transfer binary file data from one storage to the other. Supports
   * Zotero storage and WebDAV storage
   * @param  {Object} info       Source and target information
   * @param  {Zotero.Item} sourceItem An item of type "attachment"
   * @param  {Zotero.Item} targetItem An item of type "attachment"
   * @return {Promise}            A promise that resolves when the transfer is complete
   */
  transferFile : function( info, sourceItem, targetItem )
  {
    var that = this;
    return new Promise(function(resolve,reject)
    {
      // console.log( "Source is " + (isWebDav(info.source) ? "WebDAV":"Zotero") + " storage");
      // console.dir(sourceItem.apiObj.data);
      // console.log( "Target is " + (isWebDav(info.target) ? "WebDAV":"Zotero") + " storage");
      // console.dir(targetItem.apiObj.data);

      // Check arguments
      if( ! (sourceItem instanceof Zotero.Item && targetItem instanceof Zotero.Item) ||
          sourceItem.get("itemType") !== "attachment" ||
          targetItem.get("itemType") !== "attachment"  ) {
        reject(new Error("Arguments must be instances of Zotero.Item and of itemType 'attachment'.") );
      }

      console.log("Begin transfer of " + sourceItem.get("title"));

      downloadItemFile()
      .then(checkDownload)
      .then(uploadItemFile)
      .then(registerUpload)
      .then( function(){
        console.log("Transfer of " + sourceItem.get("title") + " completed");
        resolve();
      })
      .catch(reject);


      /**
       * Checks if library has a WebDAV storage
       * @param  {Object} libInfo map with static information on the library
       * @return Boolean
       */
      function isWebDav( libInfo )
      {
        return libInfo.type == "user" && config.zotero.webdavUrl;
      }

      /**
       * Returns the options map for the Request executable function
       * @param  {Object} libInfo map with static information on the library
       * @param  {Zotero.item} item    The source or target item
       * @return {Object}
       */
      function getRequestOptions( libInfo, item )
      {
        if( libInfo.type == "user" && config.zotero.webdavUrl ) {
          return {
            url: [config.zotero.webdavUrl, item.get("key") + ".zip"].join("/"),
            auth: {
                username: config.zotero.webdavUser,
                password: config.zotero.webdavPassword
            },
            headers : []
          };
        } else {
          return {
            url: [ "https://api.zotero.org",
                   (libInfo.type + "s"), libInfo.id,
                   "items", item.get("key"), "file"].join("/"),
            headers : {
              "Authorization": "Bearer " + config.zotero.apiKey
            }
          };
        }
      }

      /**
       * Downloads the source file to a temporary file
       * @return {Promise|null} Promise resolving with the path to the temporary
       * file or with null if the file does not exist
       */
      function downloadItemFile()
      {
        return new Promise(function(resolve,reject){
          var filePath = tempfile(".tmp");
          var fileName = sourceItem.get("filename");
          var options = getRequestOptions( info.source, sourceItem );

          if ( isWebDav(info.source) ){

            console.debug("Streaming " + options.url + " to " + filePath);

            request.get(options)
            .on("error", reject)
            .on('response', function(response) {
              switch( response.statusCode ){
                case 404:
                console.warn("Remote file does not exist.");
                return resolve( null );

                case 200:
                console.debug("ZIP File found.");
                return;

                default:
                console.warn("Got HTTP response " + response.statusCode + ": " + response.headers);
                return;
              }
            })
            .pipe(unzip.Parse())
            .on("close", function(){
              console.warn( fileName + " could not be found.");
              resolve(null);
            })
            .on("error", function(error){
              // ignore errors (for now)
              console.warn("Error during decompression: " + error);
              resolve(null);
            })
            .on("entry", function(entry){
              console.debug( "Found  " + entry.path );
              if (entry.path === fileName ) {
                console.debug( "Extracting ZIP file to temporary file ..." );
                entry.pipe(fs.createWriteStream(filePath))
                .on("error", reject)
                .on("close",function(){
                  console.debug( "Done extracting " + entry.path );
                  return resolve(filePath);
                });
              } else {
                entry.autodrain();
              }
            });

          } else {
            console.log("TODO: Streaming normal file from Zotero server ...");
            reject("Not implemented");
          }
        });
      }

      /**
       * Checks if download was successful. If not, resolve the outer Promise
       * @return {Promise|void} Promise resolving with the path to the temporary
       * file or nothing if the download is successful
       */
      function checkDownload(filePath)
      {
        if( filePath === null ){
          console.warn("Aborted transfer of " + sourceItem.get("title") + " ===");
          return resolve("Aborted");
        } else {
          return Promise.resolve(filePath);
        }
      }

      /**
       * Authorizes the upload with the Zotero server
       * @param  {String} filePath Path to the file to be uploaded
       * @return {Promise} Promise resolving with a map with upload information
       */
      function getUploadAutorization(filePath)
      {
        // POST /users/<userID>/items/<itemKey>/file
        // Content-Type: application/x-www-form-urlencoded
        // If-None-Match: *
        // md5=<hash>&filename=<filename>&filesize=<bytes>&mtime=<milliseconds>
        // Returns:
        // - for Zotero storage:
        // {
        //   "url": ...,
        //   "contentType": ...,
        //   "prefix": ...,
        //   "suffix": ...,
        //   "uploadKey": ...
        // }
        // or
        // { "exists": 1 }

        return new Promise(function(resolve,reject)
        {
          var fileStat = fs.statSync(filePath);
          var options = getRequestOptions( info.target, targetItem);
          console.debug("Requesting upload authorization for " +  options.url );
          options.form = {
            md5     : sourceItem.get("md5"),
            filename: sourceItem.get("filename"),
            filesize: fileStat.size,
            mtime   : sourceItem.get("mtime"),
            //params  : 1
          };
          options.headers["If-None-Match"] = "*";
          request.post(options,function(err, response, body){
            if( response.statusCode === 200){
              var result = JSON.parse(body);
              return resolve(result);
            } else if ( ! err ) {
              err = new Error( "HTTP Error Code " + response.statusCode + ": " + body );
            }
            console.warn("" + err);
            console.debug(options);
            reject(err);
          });
        });
      }


      /**
       * Uploads the file to the given storage
       * @param  {String} filePath The path to the file
       * @return {Promise}            Promise resolving with the uploadKey
       */
      function uploadItemFile(filePath)
      {
        //
        // POST file to Zotero Server
        //
        //   Concatenate prefix, the file contents, and suffix and POST to url
        //   with the Content-Type header set to contentType.
        //
        //   prefix and suffix are strings containing multipart/form-data.
        //   In some environments, it may be easier to work directly with the
        //   form parameters. Add params=1 to the upload authorization request
        //   above to retrieve the individual parameters in a params array,
        //   which will replace contentType, prefix, and suffix.
        //
        //   Common Responses
        //   201 Created	The file was successfully uploaded.
        //

        return new Promise(function(resolve, reject)
        {
          if( isWebDav( info.target ) ) {

            console.log("TODO: uploading zipped file to WebDAV server ...");
            reject("Not implemented!");

          } else {

            getUploadAutorization(filePath)
            .then(function(uploadConfig){

              console.debug("Received upload authorization...");
              //console.dir(uploadConfig);

              // File is duplicate
              if ( uploadConfig.exists ) {
                console.log("File '" + sourceItem.get("filename") + "' already exists.");
                return resolve(null);
              }

              function cleanupAndReject(err){
                fs.unlinkSync(filePath);
                reject(err);
              }

              // Create WriteStream
              var fileStat = fs.statSync(filePath);
              var uploadSize = fileStat.size + uploadConfig.prefix.length + uploadConfig.suffix.length;
              var options = {
                url : uploadConfig.url,
                headers : {
                  "Content-Type"   : uploadConfig.contentType,
                  "Content-Length" : uploadSize
                }
              };
              var bytes = 0;
              var writeStream = request.post(options)
              .on("error", cleanupAndReject )
              .on('response', function(response) {
                switch( response.statusCode ){
                  case 201:
                  case 204:
                  console.debug("Upload completed. Bytes written: " + bytes);
                  fs.unlinkSync(filePath);
                  return resolve(uploadConfig.uploadKey);

                  default:
                  err = "Http Error " + response.statusCode + ": " + response.headers;
                  cleanupAndReject( err );
                }
              });

              // Create ReadStream and pipe into WriteStream
              var multiStream = require('multistream');
              var intoStream  = require('into-stream');
              var streams = [
                intoStream(uploadConfig.prefix),
                fs.createReadStream( filePath ),
                intoStream(uploadConfig.suffix)
              ];
              multiStream(streams)
              .on("error", reject )
              .on("data",function(chunk){
                bytes += chunk.length;
                //console.debug("Sent " +  bytes + " of " + uploadSize + " bytes of data.");
              })
              .pipe( writeStream );
            })
            .catch(reject);
          }
        });
      }

      /**
       * Registers the upload with the Zotero server
       * @param  {String|null} uploadKey The upload key or null if
       *                                 registration is to be skipped (i.e., when
       *                                 the file already exists.)
       * @return {void}
       */
      function registerUpload(uploadKey)
      {
        // POST /users/<userID>/items/<itemKey>/file
        // Content-Type: application/x-www-form-urlencoded
        // If-None-Match: *
        // upload=<uploadKey>
        // For existing attachments, use If-Match: <hash>, where <hash> is the
        // previous MD5 hash of the file, provided as the md5 property in the
        // attachment item.
        //
        // Common Responses
        // 204 No Content	The upload was successfully registered.
        // 412 Precondition Failed	The file has changed remotely since
        // retrieval (i.e., the provided ETag no longer matches).
        return new Promise(function(resolve, reject)
        {
          if( uploadKey === null ){
            return resolve();
          }

          if( isWebDav( info.target ) ) {
            console.debug("Registration of upload not neccessary for WebDAV storage.");
            return resolve();
          } else {
            console.log("Registering upload with Zotero storage ...");
            var options = getRequestOptions(info.target, targetItem );
            options.form = { upload : uploadKey};
            options.headers["If-None-Match"] = "*";
            request.post(options,function(err, response, body){
              if ( err ) reject (err);
              switch( response.statusCode){
                case 200:
                case 204:
                console.debug("Upload registered.");
                return resolve();

                default:
                console.warn("HTTP Error " + response.statusCode + ": " + body );
                resolve();
              }
            }); // <== this level of nesting is annoying...
          }
        });
      }
    });
  }
};
