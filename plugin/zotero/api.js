// npm modules
var Zotero      = require('libzotero');
var Promise     = require('promise');
var JsonClient  = require('json-client');
//var Tokens      = require('map-tokens');
var request     = require('request');
var _           = require('underscore');
var unzip       = require('unzip');
var tempfile    = require('tempfile');
var fstream     = require('fstream');
var fs          = require('fs');

// local config
var config      = require('../../config');
var userLibrary   = new Zotero.Library("user", config.zotero.userId, "", config.zotero.apiKey);
var zoteroServer  = new JsonClient("https://api.zotero.org/");
var dictionary    = require('../bibsync/dictionary')(require('./dictionary'));
var database      = require('../bibsync/db');

//Zotero.preferences.setPref("debug_level", 1);

var cache = {
  treeData: {}
};
var groupLibraries = [];

/*
 * Module
 */
module.exports = {

  /**
   * Make a call to the Zotero server
   * @param  {String} call   [description]
   * @param  {String} params String of parameters
   * @return {Promise} Promise resolving with the result of the call
   */
  makeApiCall: function(call, params) {
    return zoteroServer('get', call + "?key=" + config.zotero.apiKey + (params ? "&" + params : ""));
  },

  /**
   * Returns a Zotero.Library object
   * @param  {type} type      [description]
   * @param  {mixed} libraryId [description]
   * @return {Zotero.Library}
   */
  getLibrary: function(type, libraryId) {
    if (type == "user") return this.getUserLibrary();
    return this.getGroupLibrary(libraryId);
  },

  /**
   * Returns the user library object
   * @return {Zotero.Library}
   */
  getUserLibrary: function() {
    return userLibrary;
  },

  /**
   * Returns a group library object
   * @return {Zotero.Library}
   */
  getGroupLibrary: function(groupId) {
    var groupLibrary = groupLibraries[groupId];
    if (groupLibrary === undefined) {
      groupLibrary = new Zotero.Library("group", groupId, "", config.zotero.apiKey);
      groupLibraries[groupId] = groupLibrary;
    }
    return groupLibrary;
  },

  /*
  -------------------------------------------------------------------------
  Sync API
  -------------------------------------------------------------------------
  */

  /**
   * Get the data of all libraries
   * @return {Promise} A Promise resolving with a map containing the zotero library data
   */
  getLibraries: function() {
    var that = this;
    return new Promise(function(resolve, reject) {
      that.makeApiCall("users/" + config.zotero.userId + "/groups")
        .then(function(result) {
          result = result.map(function(elem) {
            elem.data.application = "zotero";
            return elem.data;
          });
          result.unshift({
            "id": config.zotero.userId,
            "name": "Zotero User Library",
            "type": "user",
            "application": "zotero"
          });
          resolve(result);
        })
        .catch(function(err) {
          reject(err);
        });
    });
  },

  /**
   * Get the data of all collections
   * @param type {String} "user" | "group"
   * @param libraryId {Integer} Numeric id of library
   * @return {Promise} resolves with an Array of maps containing the collection
   *    data
   */
  getCollections: function(type, libraryId) {
    console.log('zotero::getCollections("' + [type, libraryId].join('","') + '")');
    var that = this;
    return new Promise(function(resolve, reject) {
      var library = that.getLibrary(type, libraryId);
      library
        .loadUpdatedCollections()
        .then(function(result) {
          var collectionObjects = library.collections.collectionObjects;
          var collections = {};
          var colllection;
          for (var key in collectionObjects) {
            colllection = library.collections.getCollection(key);
            collections[key] = {
              key: key,
              name: colllection.apiObj.data.name,
              parent: colllection.apiObj.data.parentCollection,
              version: colllection.apiObj.version
            };
          }
          //console.dir(collections);
          cache.treeData[type + libraryId] = collections;
          resolve(collections);
        }).
      catch(function(err) {
        console.warn(err);
        reject(err);
      });
    });
  },

  /**
   * Returns the collection data of the particular collection
   * @param  {String} type          Library type
   * @param  {Integer} libraryId     The numeric library id
   * @param  {String} collectionKey
   * @return {Promise} Promise resolving with the collection data
   */
  getCollection: function(type, libraryId, collectionKey) {
    console.log("zotero::getCollection("+[type, libraryId, collectionKey].join(",")+")");
    // we don't have a cache yet, create it
    var that = this;
    if (!cache.treeData[type + libraryId]) {
      return new Promise(function(resolve, reject) {
        that.getCollections(type, libraryId)
          .then(function() {
            that.getCollection(type, libraryId, collectionKey)
              .then(resolve);
          }).catch(function(err) {
            reject(err);
          });
      });
    }
    // retrieve from cache
    return Promise.resolve(cache.treeData[type + libraryId][collectionKey]);
  },

  /**
   * Returns the collection data of the particular collection.
   * This function is called synchronously, this requires that the
   * collection data has already been downloaded and cached.
   * @param  {String} type          Library type
   * @param  {Integer} libraryId     The numeric library id
   * @param  {String} collectionKey
   * @return {Map}
   */
  getCollectionSync: function(type, libraryId, collectionKey) {
    console.log("zotero::getCollectionSync("+[type, libraryId, collectionKey].join(",")+")");
    if (!cache.treeData[type + libraryId]) {
      throw new Error("No cached data available");
    }
    return cache.treeData[type + libraryId][collectionKey];
  },

  /**
  * Returns the ids of the items in the particular collection
  * @param  {String} type          Library type
  * @param  {Integer} libraryId     The numeric library id
  * @param  {String} collectionKey
  * @return {Promise} Promise resolving with the ids of the items in the collection
   */
  getCollectionIDs : function(type, libraryId, collectionKey) {
    console.log("zotero::getCollectionIDs("+[type, libraryId, collectionKey].join(",")+")");
    var that=this;
    return new Promise(function(resolve, reject) {
      var library = that.getLibrary( type, libraryId );
      library.collections.getCollection(collectionKey).getMemberItemKeys()
        .then(function(ids){
          resolve(ids);
        })
        .catch(reject);
    });

  },

  /**
   * Returns the collectionKeys of the children of the given collection
   * This function is called synchronously, this requires that the
   * collection data has already been downloaded and cached.
   * @param  {String} type          The type of library
   * @param  {Integer} libraryId    The id of the library
   * @param  {String} collectionKey [description]
   * @return {Array}  An array of collection keys
   */
  getCollectionChildKeysSync: function(type, libraryId, collectionKey) {
    //console.log("zotero::getCollectionChildKeysSync("+[type, libraryId, collectionKey].join(",")+")");

    if (!cache.treeData[type + libraryId]) {
      throw new Error("No cached data available");
    }
    var treeData = cache.treeData[type + libraryId];
    var keys = [];
    for (var key in treeData) {
      if ( treeData[key].parent == collectionKey ) {
        keys.push(treeData[key].key);
      }
    }
    return keys;
  },

  /**
   * Returns true if collections can be created, false if not
   * @return {Boolean}
   */
  canCreateCollection : function(){
    return true;
  },


  /**
   * Adds a collection.
   * @param  {String} type          The type of library
   * @param  {Integer} libraryId    The id of the library
   * @param {Map} data A Map containing the collection data. Must have at least
   *                   these keys: name {String}, parent : {String}
   * @return {Promise}  A Promise which resolves with the newly created key of the
   *                    collection
   */
  addCollection : function(type, libraryId, data){
      throw new Error("Not implemented");
  },

  /**
   * Adds a collection locally (and synchronously). Needs to be synchronized with
   * the remote target later.
   * @param  {String} type          The type of library
   * @param  {Integer} libraryId    The id of the library
   * @param {Map} data A Map containing the collection data. Must have at least
   *                   these keys: name {String}, parent : {String}
   * @return {String}  The collection key of the newly created collection
   */
  addCollectionLocallySync : function(type, libraryId, data){
    	var library = this.getLibrary(type, libraryId);
    	var collection = new Zotero.Collection();
    	collection.associateWithLibrary(library);
    	collection.set('name', data.name);
    	collection.set('parentCollection', data.parent);
    	return collection.get("key");
  },

  /**
   * Synchronizes locally created / edited collection
   * @param  {[type]} type      [description]
   * @param  {[type]} libraryId [description]
   * @param  {[type]} ids       [description]
   * @return {[type]}           [description]
   */
  writeCollections : function(type, libraryId, ids)
  {
    throw new Error("Not implemented");
  },

  /**
   * Get the data of all items in a collection
   * @param libraryType {String} "user" | "group"
   * @param libraryId {Integer} Numeric id of library
   * @param collectionKey {String} Key of the collection
   * @param fields [Array|undefined] Optional array of fields to use. If omitted, all
   *  fields in the retrieved record are returned.
   * @return {Promise} resolves with an Array of maps containing the collection
   *    data
   */
  getCollectionItems: function(libraryType, libraryId, collectionKey, fields) {
    console.log("zotero::getCollectionItems("+[libraryType, libraryId, collectionKey].join(",")+")");
    var that = this;
    return new Promise(function(resolve, reject) {
      var library = that.getLibrary(libraryType, libraryId);
      library.loadItems({
        collectionKey: collectionKey
      }).then(function(data) {
        var result = [];
        var promises = [];

        // iterate over items
        data.loadedItems.forEach(function(item){
          var globalItem = _.omit( dictionary.translateToGlobal( item.apiObj.data ), function(value){
            return !value;
          });
          if ( _.isArray(fields) && fields.length ){
            globalItem = _.pick( globalItem, fields );
          }
          // add type if missing
          if ( ! globalItem.itemType )
          {
            globalItem.itemType = dictionary.getGlobalContent( "itemType", item.apiObj.data);
          }

          // add version
          globalItem.version = item.get("version");

          // add special fields if requested
          if( _.isArray(fields) && fields.length ) {
            if ( fields.indexOf("creatorSummary") !== -1 )
            {
              globalItem.creatorSummary = item.get("creatorSummary");
            }
            // add year if requested
            if( fields.indexOf("year") !== -1 )
            {
              globalItem.year = item.get("year");
            }
          }

          // children
          if( _.isArray(fields) ? _.intersection(fields, ["attachments","notes"]).length : 1 ) {
            var parentItem = globalItem;
            promises.push(new Promise(function(resolve,reject){
              item.getChildren(item.owningLibrary).then(function(childItems){
                //console.log("Item child count:" + childItems.length);
                childItems.forEach(function(childItem){
                  switch(childItem.get("itemType")){
                    case "attachment":
                    var filename = childItem.get("filename");
                    parentItem.attachments =
                      (parentItem.attachments?parentItem.attachments.split(/;/):[])
                        .concat(filename).join(";");
                    break;
                  }
                });
                resolve();
              }).catch(reject);
            }));
          }

          result.push(globalItem);
        });

        // resolve when all child items have been inspected
        Promise.all(promises).then(function(){
            resolve(result);
        }).catch(reject);

      }).catch(reject);
    });
  },

  /**
   * Creates a new item in the library
   *
   * @param  {String}  libraryType Library type (user/group)
   * @param  {Integer} libraryId   Library id
   * @param  {Object}  itemData    The item data
   * @return {Promise} A promise resolving with the id of the newly created item
   *
   */
  createItem : function( libraryType, libraryId, itemData )
  {
    var info = JSON.parse(itemData.info);
    if( info.source.application=="zotero")
    {
      return this.copyItem ( libraryType, libraryId, itemData );
    }
    return new Promise(function(resolve,reject){

      var sourceItemId = itemData.id;

      // console.log("=== from client ===");
      // console.dir(itemData);
      // console.dir(info);

      delete itemData.id;
      delete itemData.dateAdded;
      delete itemData.info;
      delete itemData.collections;

      var data = dictionary.translateToLocal(itemData);
      // console.log("=== translated to local format ===");
      // console.dir(data);
      var library = this.getLibrary( libraryType, libraryId );
      var item = new Zotero.Item();
      item.associateWithLibrary(library);
      item.initEmpty(data.itemType)
      .then(function(item){

        // notes
        if( data.notes ){
          var childNote1 = new Zotero.Item();
          childNote1.initEmptyNote();
          childNote1.set('note', data.notes);
    			item.notes = [childNote1];
          delete data.notes;
        }

        // collection
        item.addToCollection(info.target.collectionKey);

        // attachments
        if( data.attachments ){
          data.attachments.split(";").forEach(function(filename){

          },this);
        }

        // set properties
        for( var key in data ) {
          item.set(key,data[key]);
        }

        // write it to zotero server
        item.writeItem().then(function(newItems){
          //console.log("=== saved in library ===");
          database.save(info, sourceItemId, item.key )
            .then(resolve)
            .catch(reject);

        }).catch(reject);
      })
      .catch(reject);

    }.bind(this));
  },

  /**
   * Copies an  item from a (differen) library
   *
   * @param  {String}  libraryType Library type (user/group)
   * @param  {Integer} libraryId   Library id
   * @param  {Object}  itemData    The item data
   * @return {Promise} A promise resolving with the id of the newly created item
   *
   */
  copyItem : function( libraryType, libraryId, itemData )
  {
    var info = JSON.parse(itemData.info);
    console.log("-".repeat(80));
    console.log("Copying item #" + itemData.id );
    console.log("-".repeat(80));

    //console.dir(info);

    var sourceLibrary = this.getLibrary( info.source.type, info.source.id );
    var targetLibrary = this.getLibrary( libraryType, libraryId );
    var sourceItem  = null;
    var targetItem  = null;
    var targetItemKey = "";
    var sourceAttachmentItems = [];

    var that = this;

    return new Promise(function(resolve,reject){
      sourceLibrary.loadItem( itemData.id )
      .then(function(item){
        sourceItem = item;
        return sourceLibrary.sendToLibrary([sourceItem],targetLibrary);
      })
      .then(function(result){
        targetItemKey = result[0].returnItems[0].get("key");
        return targetLibrary.loadItem( targetItemKey );
      })
      .then(function(item){
        targetItem = item;
        return sourceItem.getChildren(sourceLibrary);
      })
      .then(copyChildItems)
      .then(addTargetItemToCollection)
      .then(reloadTargetItem)
      .then(function(targetItem){
        return targetItem.getChildren(targetLibrary);
      })
      .then(configureChildItems)
      .then(function(){
        console.log("=== DONE ===");
        resolve("OK");
      })
      .catch(reject);
    });

    /**
     * Reload the copied item from the target database
     * @return {Promise} A Promise that resolves with the reloaded target item
     */
    function reloadTargetItem(){
      return targetLibrary.loadItem( targetItemKey );
    }

    /**
     * Adds the copied item to the target collection
     * @return {Promise} A pormise that resolves when the item has been written
     * to the database
     */
    function addTargetItemToCollection()
    {
      var targetCollectionKey =  info.target.collectionKey;
      console.log(">>> Saving and adding item to collection #"+ targetCollectionKey);
      targetItem.addToCollection(targetCollectionKey);
      targetItem.associateWithLibrary(targetLibrary);
      return targetItem.writeItem();
    }

    /**
     * Creates copies of child items. Implemented so far:
     *  - file attachments:
     *  - notes
     * @param  {Zotero.Items[]} childItems An array of child items
     * @return {Promise}   A promise that resolves when all child items copies are
     *                     created.
     */
    function copyChildItems(childItems){
      // console.log("=== sourceChildItems ===");
      // console.dir(childItems);

      var childItemPromises = [];
      targetItem.attachments = [];
      targetItem.notes = [];

      childItems.forEach(function(childItem){
        var item = new Zotero.Item(), p, keys;
        var itemType = childItem.get("itemType");
        var linkMode = childItem.get("linkMode");
        var extendedItemType = itemType + (linkMode ? "/" + linkMode : "");
        switch( extendedItemType ){

          case "attachment/imported_file":
          console.log(">>> Adding file attachment " + childItem.get("title") );
          p = item.initEmpty('attachment',"imported_file")
          .then(function(attachmentItem){
            ["title","contentType","charset","filename","url"].forEach(function(key){
                attachmentItem.set(key, childItem.get(key) );
            });
            attachmentItem.set('parentItem', targetItem.get("key"));
            attachmentItem.associateWithLibrary(targetLibrary);
            targetItem.attachments.push(attachmentItem);
            sourceAttachmentItems.push(childItem);
          });
          childItemPromises.push(p);
          break;

          case "note":
          console.log(">>> Adding note " + childItem.get("title") );
          p = item.initEmpty('note')
          .then(function(noteItem){
            keys = ["title","note","tags","relations","contentType","charset"];
            keys.forEach(function(key){
              noteItem.set(key,childItem.get(key));
            });
            noteItem.set('parentItem', targetItem.get("key"));
            noteItem.associateWithLibrary(targetLibrary);
            targetItem.notes.push(noteItem);
          });
          childItemPromises.push(p);
          break;

          default:
          console.log(">>> Not adding "+extendedItemType + " " + childItem.get("title") );
        }
      });
      return Promise.all(childItemPromises);
    }

    /**
     * Configures the child item clones created by copyChildItems after they
     * have been initialized on the server
     * @param  {Zotero.Items[]} childItems
     * @return {Promise}      A promise that resolves when all the child items
     *                        have been configured
     */
    function configureChildItems(childItems)
    {
      //console.dir(childItems);
      //console.dir(childItems.map(function(item){return item.apiObj.data;}));
      var attachmentIndex = 0, sourceAttachmentItem;
      var promises = [];
      childItems.forEach(function(childItem){
        if( childItem.get("itemType") == "attachment" ){
          sourceAttachmentItem = sourceAttachmentItems[attachmentIndex++];
          // console.dir(sourceAttachmentItem.apiObj);
          // console.dir(childItem.apiObj);

          ["note","tags","md5","mtime"].forEach(function(key){
              childItem.set(key, sourceAttachmentItem.get(key) );
          });
          var href = ["https://api.zotero.org",info.source.type,
            info.source.id,"items",sourceAttachmentItem.get("key")].join("/");
          childItem.set('relations', { "owl:sameAs" : href });
          promises.push( childItem.writeItem() );

          // this transfers the real file attachment
          //console.dir(childItem.apiObj);
          promises.push(that.transferAttachmentFile( info, sourceAttachmentItem, childItem ));
        }
      });
      return Promise.all(promises);
    }

  },

  /**
   * Transfer binary file data from one storage to the other. Supports
   * Zotero storage and WebDAV storage
   * @param  {Object} info       Source and target information
   * @param  {Zotero.Item} sourceItem [description]
   * @param  {Zotero.Item} targetItem [description]
   * @return {Promise}            A promise that resolves when the transfer is complete
   */
  transferAttachmentFile : function( info, sourceItem, targetItem )
  {
    var that = this;
    return new Promise(function(resolve,reject)
    {
      // console.log( ">>> Source is " + (isWebDav(info.source) ? "WebDAV":"Zotero") + " storage");
      // console.dir(sourceItem.apiObj.data);
      // console.log( ">>> Target is " + (isWebDav(info.target) ? "WebDAV":"Zotero") + " storage");
      // console.dir(targetItem.apiObj.data);
      //
      console.log("=== Begin transfer of " + sourceItem.get("title") + " ===");

      download()
      .then(upload)
      .then(registerUpload)
      .then( function(){
        console.log("=== Transfer of " + sourceItem.get("title") + " completed ===");
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
       * @return {Promise} Promise resolving with the path to the temporary file
       */
      function download()
      {
        return new Promise(function(resolve,reject){
          var file = tempfile(".tmp");
          var options = getRequestOptions( info.source, sourceItem );

          if ( isWebDav(info.source) ){
            console.log(">>> Streaming ZIP from WebDAV server at " + options.url);
            request.get(options)
            .on("error", reject)
            .pipe(unzip.Parse())
            .on("entry", function(entry){
              console.log( ">>> Found  " + entry.path );
              if (entry.path === sourceItem.get("filename") ) {
                console.log( ">>> Extracting ZIP file to temporary file ..." );
                //console.log( ">>> " + file );
               entry.pipe(fs.createWriteStream(file))
                .on("close",function(){
                  console.log( ">>> Done extracting " + entry.path );
                  resolve(file);
                });
              } else {
                entry.autodrain();
              }
            });

          } else {
            console.log(">>> TODO: Streaming normal file from Zotero server ...");
            reject("Not implemented");
          }
        });
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
          console.log(">>> Requesting upload authorization for " +  options.url );
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
            console.log(">>> " + err);
            console.dir(options);
            reject(err);
          });
        });
      }


      /**
       * Uploads the file to the given storage
       * @param  {String} filePath The path to the file
       * @return {Promise}            Promise resolving with the uploadKey
       */
      function upload(filePath)
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

            console.log(">>> TODO: uploading zipped file to WebDAV server ...");
            reject("Not implemented!");

          } else {

            getUploadAutorization(filePath)
            .then(function(uploadConfig){

              console.log(">>> Received upload authorization...");
              //console.dir(uploadConfig);

              // File is duplicate
              if ( uploadConfig.exists ) {
                console.log(">>> File '" + sourceItem.get("filename") + "' already exists.");
                return resolve(null);
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
              .on("error", reject )
              .on('response', function(response) {
                switch( response.statusCode ){
                  case 201:
                  case 204:
                  console.log(">>> Upload completed. Bytes written: " + bytes);
                  return resolve(uploadConfig.uploadKey);

                  default:
                  err = "Http Error " + response.statusCode + ": " + response.headers;
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
              .on("error", reject )
              .on("data",function(chunk){
                bytes += chunk.length;
                console.log("    Received " +  bytes + " of " + uploadSize + " bytes of data.");
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
            console.log(">>> Registration of upload not neccessary for WebDAV storage.");
            return resolve();
          } else {
            console.log(">>> Registering upload with Zotero storage ...");
            var options = getRequestOptions(info.target, targetItem );
            options.form = { upload : uploadKey};
            options.headers["If-None-Match"] = "*";
            request.post(options,function(err, response, body){
              if ( err ) reject (err);
              switch( response.statusCode){
                case 200:
                case 204:
                console.log(">>> Upload registered.");
                return resolve();

                default:
                console.log("HTTP Error " + response.statusCode + ": " + body );
                resolve();
              }
            }); // <== this level of nesting is annoying...
          }
        });
      }
    });
  }
};
