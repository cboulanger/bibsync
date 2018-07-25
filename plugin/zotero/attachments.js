var request     = require("request");
var fs          = require('fs');
var unzip       = require('unzip');
var tempfile    = require('tempfile');
var fstream     = require('fstream');

module.exports = function (sandbox){

  var config       = sandbox.getConfig();
  var console      = sandbox.getConsole();

  /**
   * Tries to retrieve the written item from the response of
   * item.writeItem(). Returns false if the writeItem request
   * failed.
   * @param  {Object} result Result of item.writeItem()
   * @return {Zotero.Item|false}
   */
  function getItemFromWriteResult(result) {
    try {
      return result[0].returnItems[0];
    } catch (e) {
      return false;
    }
  }

  // API
  return {

    /**
     * Configures the child attachments of the target item after they
     * have been saved on the server. Calls method that transfers the
     * files connected with the attachment items
     * @param  {Object} info Source and target information
     * @param {Zotero.Item[]}  sourceAttachmentItems The items to copy from. If
     * the attachments are stored outside the Zotero file storage, pass unconfigured
     * Zoter.Item objects.
     * @param {Zotero.Items[]} targetChildItems The children of the target item
     * (not all of them are file attachments, can be notes, links etc.)
     * @return {Promise}      A promise that resolves when all the child items
     *                        have been configured
     */
    copyAttachmentFiles : function(info, sourceAttachmentItems, targetChildItems) {
      var self = this;
      if(targetChildItems===false){
        return false;
      }
      console.debug("Copying attachments files ...");
      if( targetChildItems.length === 0 ){
        console.debug("No child attachments.");
        return Promise.resolve();
      }
      // async loop to upload attachments one afte the other

      return targetChildItems.reduce(function( promise, targetChildItem, index ){
        var itemType = targetChildItem.get("itemType");
        var linkMode = targetChildItem.get("linkMode");
        var extendedItemType = itemType + (linkMode ? "/" + linkMode : "");
        switch (extendedItemType) {
          case "attachment/imported_file":
          case "attachment/imported_url":
          return promise.then(function(){
            console.debug( "Writing attachment "+targetChildItem.get("title") );
            var sourceAttachmentItem = sourceAttachmentItems[index];
            if( sourceAttachmentItem instanceof Zotero.Item )
            {
              ["note", "tags", "md5", "mtime"].forEach(function(key) {
                var value = sourceAttachmentItem.get(key);
                if( value ) targetChildItem.set(key, value);
              });
              var href = ["https://api.zotero.org", info.source.type, info.source.id,
                "items", sourceAttachmentItem.get("key")].join("/");
              targetChildItem.set('relations', {
                "owl:sameAs": href
              });
            } else {
              console.debug(sourceAttachmentItem);
              console.warn("Source attachment item ist not a Zotero.Item instance. Skipping...");
              return Promise.resolve();
            }
            return targetChildItem.writeItem()
            .then(getItemFromWriteResult)
            // .then(function(item){
            //   targetItemKey = item.get("key");
            //   console.debug("Target item has been written to the server with key " + targetItemKey + ". Reloading...");
            //   return targetChildItem.owningLibrary.loadItem(targetItemKey);
            // })
            .then(function(item){
              if( item && sourceAttachmentItem ){
                return self.transferFile(info, sourceAttachmentItem, item )
                .then(function(success){
                  if (success) {
                    console.debug("Attachment sucessfully transferred.");
                  } else {
                    console.debug("Problem transferring the attachment.");
                  }
                  return Promise.resolve(success);
                });
              } else {
                if ( ! item ) {
                  console.warn("Problem writing child item to server");
                }
                return Promise.resolve(false);
              }
            });
          });
          default:
          console.debug("Ignoring attachment " + targetChildItem.get("title") );
          return Promise.resolve();
        }
      }, Promise.resolve());
    },

    /**
     * Transfer binary file data from one storage to the other. Supports
     * zotero.org storage and Zotero WebDAV storage
     * @param  {Object} info       Source and target information
     * @param  {Zotero.Item} sourceItem An item of type "attachment"
     * @param  {Zotero.Item} targetItem An item of type "attachment"
     * @return {Promise}            A promise that resolves when the transfer is complete
     */
    transferFile : function( info, sourceItem, targetItem )
    {
      var that = this;
      //console.debug( "Source is " + (isWebDav(info.source) ? "WebDAV":"Zotero") + " storage");
      //console.debug(sourceItem.apiObj.data);
      //console.debug( "Target is " + (isWebDav(info.target) ? "WebDAV":"Zotero") + " storage");
      //console.debug(targetItem.apiObj.data);
      // Check arguments
      if( ! (sourceItem instanceof Zotero.Item && targetItem instanceof Zotero.Item) ||
          sourceItem.get("itemType") !== "attachment" ||
          targetItem.get("itemType") !== "attachment"  ) {
        throw new Error("Arguments must be instances of Zotero.Item and of itemType 'attachment'.");
      }
      console.log("Begin transfer of " + sourceItem.get("title"));

      // main procedure
      return downloadItemFile()
      .then(checkDownload)
      .then(uploadItemFile)
      .then(registerUpload)
      .then( function(success){
        var msg = success ? " sucessfully completed." : " failed.";
        console.info("Transfer of " + sourceItem.get("title") + msg );
        return success;
      });

      /**
       * Checks if library has a WebDAV storage
       * @param  {Object} libInfo map with static information on the library
       * @return Boolean
       */
      function isWebDav( libInfo )
      {
        try {
          var storage = config[libInfo.application].storage;
          if( storage && typeof storage.webdav == "object" ){
            // TODO: check credentials & url

            // Zotero: use WebDAV if configured for user library, zotero-server for group libraries
            if ( libInfo.application == "zotero" && libInfo.type == "group" ) return false;
            return true;
          }
          return false;
        } catch(e) {
          throw new Error("Invalid storage configuration");
        }
      }

      /**
       * Returns the options map for the Request executable function
       * @param  {Object} libInfo map with static information on the library
       * @param  {Zotero.item} item    The source or target item
       * @return {Object}
       */
      function getRequestOptions( libInfo, item )
      {
        if( isWebDav( libInfo ) ) {

          var webdav = config[libInfo.application].storage.webdav;
          // console.debug(webdav);
          // console.debug(item.apiObj.data);
          var filename = item.get(webdav.filenameKey) + ( webdav.zipped ? ".zip" : "");
          return {
            url: [webdav.url, filename ].join("/"),  // TODO
            auth: {
                username: webdav.user,
                password: webdav.password
            },
            headers : []
          };
        } else { // TODO
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
        var filePath = tempfile(".tmp");
        var fileName = sourceItem.get("filename");
        var options = getRequestOptions( info.source, sourceItem );
        var found = false;
        var bytes=0, filesize=0;
        if ( isWebDav(info.source) ){
          var webdav = config[info.source.application].storage.webdav;
          console.debug("Streaming " + options.url + " to " + filePath);
          return new Promise(function(resolve,reject){

            var readStream = request.get(options)
            .on("error", reject)
            .on('response', function(response) {
              switch( response.statusCode ){
                case 401:
                reject("Authorization with remote WebDAV server failed.");
                case 404:
                console.warn("Remote file does not exist.");
                return resolve( false );
                case 200:
                filesize = response.headers['content-length'];
                console.debug("File found.");
                return;
                default:
                console.warn("Got HTTP response " + response.statusCode + ": " + JSON.stringify(response.headers));
                return resolve( false );
              }
            })
            .on("data",function(chunk){
              bytes += chunk.length;
              sandbox.showFileProgress(bytes/filesize*100,"Downloading "+fileName);
              //console.debug("Sent " +  bytes + " of " + uploadSize + " bytes of data.");
            })

            if ( webdav.zipped ){
              readStream.pipe(unzip.Parse())
              .on("close", function(){
                sandbox.hideFileProgress();
                if( ! found ){
                  console.warn( fileName + " could not be found.");
                  resolve(false);
                }
              })
              .on("error", function(error){
                sandbox.hideFileProgress();
                console.warn("Error during decompression: " + error);
                resolve(false);
              })
              .on("entry", function(entry){
                console.debug( "Found  " + entry.path );
                if (entry.path === fileName ) {
                  found = true;
                  console.debug( "Extracting ZIP file to temporary file ..." );
                  entry.pipe(fs.createWriteStream(filePath))
                  .on("error", function(e){
                    sandbox.hideFileProgress();
                    console.warn("Error writing extracted file to disk:" + e);
                    resolve(false);
                  })
                  .on("close",function(){
                    console.debug( "Done extracting " + entry.path );
                    resolve(filePath);
                  });
                } else {
                  entry.autodrain();
                }
              });
            } else {
              console.debug( "Downloading to temporary file ..." );
              readStream.pipe(fs.createWriteStream(filePath))
              .on("error", function(e){
                sandbox.hideFileProgress();
                console.warn("Error writing file to disk:" + e);
                resolve(null);
              })
              .on("close",function(){
                console.debug( "Done writing " + filePath );
                resolve(filePath);
              });
            }
          });
        } else {
          console.log("TODO: Streaming normal file from Zotero server ...");
          throw new Error("Not implemented");
        }
      }

      /**
       * Checks if download was successful. If not, resolve the outer Promise
       * @return {Promise|void} Promise resolving with the path to the temporary
       * file or nothing if the download is successful
       */
      function checkDownload(filePath)
      {
        if( filePath === false ){
          console.warn("Aborted transfer of " + sourceItem.get("title") );
          return false;
        } else {
          return filePath;
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
          sandbox.showFileProgress(0,"Uploading to Zotero server...");
          console.debug("Requesting upload authorization for " +  options.url );
          options.form = {
            md5     : sourceItem.get("md5") || require('md5-file').sync(filePath),
            filename: sourceItem.get("filename"),
            filesize: fileStat.size,
            mtime   : sourceItem.get("mtime") || fileStat.mtime.getTime(), // in milliseconds!
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
            console.error("" + err);
            console.debug(response);
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
        if ( ! filePath ) {
          // pass on negative result
          return filePath;
        }
        var filename = sourceItem.get("filename");
        if( isWebDav( info.target ) ) {
          console.log("uploading zipped file to WebDAV server ...");
          uploadToWebDav(info,filePath);
          //throw new Error("Not implemented!");
        } else {
          return getUploadAutorization(filePath)
          .then(function(uploadConfig){
            console.debug("Received upload authorization...");
            // File is duplicate
            if ( uploadConfig.exists ) {
              sandbox.showFileProgress(99,"File exists.");
              setTimeout(sandbox.hideFileProgress,3000);
              console.log("File '" + filename + "' already exists.");
              return Promise.resolve(true);
            }
            function cleanupAndReject(err){
              sandbox.hideFileProgress();
              fs.unlinkSync(filePath);
              throw new Error(err);
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
            return new Promise(function(resolve, reject){
              var writeStream = request.post(options)
              .on("error", cleanupAndReject )
              .on('response', function(response) {
                sandbox.hideFileProgress();
                fs.unlinkSync(filePath);
                switch( response.statusCode ){
                  case 201:
                  case 204:
                  console.debug("Upload completed. Bytes written: " + bytes);
                  return resolve(uploadConfig.uploadKey);
                  default:
                  var err = "Http Error " + response.statusCode + ": " + response.headers;
                  reject( err );
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
              .on("error", cleanupAndReject)
              .on("data",function(chunk){
                bytes += chunk.length;
                sandbox.showFileProgress(bytes/uploadSize*100,"Uploading "+ filename );
                //console.debug("Sent " +  bytes + " of " + uploadSize + " bytes of data.");
              })
              .pipe( writeStream );
            });
          });
        }
      }

      function uploadToWebDav(info,filePath){
        


      }

      /**
       * Registers the upload with the Zotero server
       * @param  {String|null} uploadKey The upload key or null if
       *                                 registration is to be skipped (i.e., when
       *                                 the file already exists.)
       * @return {Boolean} Success (true) or failure (false)
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

        // file exists
        if ( uploadKey === false || uploadKey === true ) {
          // pass on result TODO this should be handled with exceptions
          return uploadKey;
        }
        if( isWebDav( info.target ) ) {
          console.debug("Registration of upload not neccessary for WebDAV storage.");
          return;
        } else {
          console.log("Registering upload with Zotero storage ...");
          var options = getRequestOptions(info.target, targetItem );
          options.form = { upload : uploadKey};
          options.headers["If-None-Match"] = "*";
          return new Promise(function(resolve, reject){
            request.post(options,function(err, response, body){
              if ( err ) return reject (err);
              switch( response.statusCode){
                case 200:
                case 204:
                console.debug("Upload registered.");
                return resolve(true);
                default:
                console.warn("HTTP Error " + response.statusCode + ": " + body );
                resolve(false);
              }
            });
          });
        }
      }
    }
  };
};
