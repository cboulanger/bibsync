// modules
var Zotero      = require('libzotero');
var Promise     = require('promise');
var JsonClient  = require('json-client');
var request     = require('request');
var _           = require('underscore');

/**
 * Zotero API
 * @param  {Object} sandbox An object exposing the BibSync API
 * @return {Object} An object exposing API methods
 */
module.exports = function(sandbox)
{
  var dictionary   = sandbox.getGlobalDictionary(require('./dictionary'));
  var config       = sandbox.getConfig();
  var console      = sandbox.getConsole();
  var userLibrary  = new Zotero.Library("user", config.zotero.userId, "", config.zotero.apiKey);
  var zoteroServer = new JsonClient("https://api.zotero.org/");
  var attachmentManager = require('./attachments')(sandbox);

  /*
   Helper functions
   */

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

  /**
   * function that can be plugged into a then-chain to inspect
   * a value passed from one promise to the next
   * @param  {[type]} result [description]
   * @return [type]          [description]
   */
  function debugResult(result) {
    console.debug(result);
    return result;
  }

  /*
   Closure variables for the API
   */
  var cache = {
    treeData: {}
  };
  var groupLibraries = [];

  /*
   API
   */
  return {
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
      return this.makeApiCall("users/" + config.zotero.userId + "/groups")
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
        return result;
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
      console.debug('zotero::getCollections(' + [type, libraryId].join(',') + ')');
      var that = this;
      return new Promise(function(resolve, reject) { // TODO Superflous Promise
        var library = that.getLibrary(type, libraryId);
        console.debug("Loading updated collections from server...");
        library.loadUpdatedCollections()
        .then(function(result) {
          var collectionObjects = library.collections.collectionObjects;
          var collections = {};
          var colllection;
          for (var key in collectionObjects) {
            colllection = library.collections.getCollection(key);
            collections[key] = {
              key: key,
              name: colllection.apiObj.data.name,
              parentKey: colllection.apiObj.data.parentCollection
            };
          }
          cache.treeData[type + libraryId] = collections;
          resolve(collections);
        })
        .catch(reject);
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
      console.debug("zotero::getCollection(" + [type, libraryId, collectionKey].join(",") + ")");
      var that = this;
      var cachedCollections = cache.treeData[type + libraryId];
      var isCached = _.isObject( cachedCollections ) &&
                     _.isObject( cachedCollections[collectionKey] );
      return new Promise(function(resolve, reject) { // TODO Superflous Promise
        if ( false /*isCached*/ ) {
          resolve( cachedCollections[collectionKey] );
        } else {
          console.debug("No cached collections. Need to get them from server.");
          that.getCollections(type, libraryId)
          .then(function(collections) {
            // if( collections === undefined ){
            //   reject("Houston, there is a problem");
            // }
            resolve(collections[collectionKey]);
          })
          .catch(reject);
        }
      });
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
      console.debug("zotero::getCollectionSync(" + [type, libraryId, collectionKey].join(",") + ")");
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
    getCollectionIDs: function(type, libraryId, collectionKey) {
      console.log("zotero::getCollectionIDs(" + [type, libraryId, collectionKey].join(",") + ")");
      var that = this;
      return new Promise(function(resolve, reject) { // TODO Superflous Promise
        var library = that.getLibrary(type, libraryId);
        library.collections.getCollection(collectionKey).getMemberItemKeys()
        .then(function(ids) {
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
      console.debug("zotero::getCollectionChildKeysSync(" + [type, libraryId, collectionKey].join(",") + ")");

      if (!cache.treeData[type + libraryId]) {
        throw new Error("No cached data available");
      }
      var treeData = cache.treeData[type + libraryId];
      var keys = [];
      for (var key in treeData) {
        if (treeData[key].parentKey == collectionKey) {
          keys.push(treeData[key].key);
        }
      }
      return keys;
    },

    /**
     * Returns true if collections can be created, false if not
     * @return {Boolean}
     */
    canCreateCollection: function() {
      return true;
    },


    /**
     * Adds a collection.
     * @param {String} type The type of library
     * @param {String} libraryId The id of the library
     * @param {Object} data A Map containing the collection data.
     * Must have at least these keys: name {String}, parentKey : {String}
     * @return {Promise} A Promise which resolves when the collections
     * have been written to the server with the key of the new collection
     */
    addCollection: function(type, libraryId, data) {
      console.debug("zotero::addCollection(" + [type, libraryId, "(data)"].join(",") + ")");
      if( !("name" in data && "parentKey" in data ) ){
        throw "Data must contain keys 'name' and 'parentKey'";
      }
      var that = this;
      var collection = that._addCollectionLocallySync(type, libraryId, data);
      console.debug("Writing to the server ..." ) ;
      return that.getLibrary(type, libraryId).collections
      .writeCollections([collection])
      .then(function(result) {
        var newCollectionKey = result[0].returnCollections[0].get("key");
        return newCollectionKey;
      })
      .catch(Promise.reject);
      //});
    },

    /**
     * Adds a collection locally (and synchronously). Needs
     * to be synchronized with the remote target later.
     * @param {String} type The type of library
     * @param {Integer} libraryId The id of the library
     * @param {Map} data A Map containing the collection data. Must
     * have at least these keys: name {String}, parentKey : {String}
     * @return {Zotero.Collection} The newly created collection
     */
    _addCollectionLocallySync: function(type, libraryId, data) {
      console.debug("Adding collection locally...");
      var library = this.getLibrary(type, libraryId);
      var collection = new Zotero.Collection();
      collection.associateWithLibrary(library);
      collection.set('name', data.name);
      collection.set('parentCollection', data.parentKey);
      return collection;
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
      console.debug("zotero::getCollectionItems(" + [libraryType, libraryId, collectionKey].join(",") + ")");
      var that = this;
      return new Promise(function(resolve, reject) { // TODO: uneccessary promise!
        var result = [];
        that.getLibrary(libraryType, libraryId)
        .loadItems({
          collectionKey: collectionKey
        })
        .then(function(data) {
          if( ! ( data && _.isObject(data) && _.isArray(data.loadedItems) ) ){
            console.warn("Collection does not exist.");
            reject("Collection does not exist.");
            return;
          }
          //console.debug(data.loadedItems);
          var promises = [];
          // iterate over items
          data.loadedItems.forEach(function(item) {
            // THIS MUST GO INTO SEPARATE FUNCTION!!!!
            var globalItem = _.omit(dictionary.translateToGlobal(item.apiObj.data), function(value) {
              return !value;
            });
            if (_.isArray(fields) && fields.length) {
              globalItem = _.pick(globalItem, fields);
            }
            if (globalItem.itemType == "attachment") {
              console.warn("Skipping '" + globalItem.title + "' - item type 'attachment' currently not supported. ");
              return;
            }
            // add type if missing
            if (!globalItem.itemType) {
              globalItem.itemType = dictionary.getGlobalContent("itemType", item.apiObj.data);
            }
            // add itemUri
            globalItem.itemUri = item.apiObj.links.self.href;
            // add special fields if requested
            if (_.isArray(fields) && fields.length) {
              if (fields.indexOf("creatorSummary") !== -1) {
                globalItem.creatorSummary = item.get("creatorSummary");
              }
              // add year if requested
              if (fields.indexOf("year") !== -1) {
                globalItem.year = item.get("year");
              }
            }
            // children
            var doInspectChildren = _.isArray(fields) ? _.intersection(fields, ["attachments", "notes"]).length : true;
            if (doInspectChildren) {
              var parentItem = globalItem;
              var p = new Promise(function(resolve, reject) {

                item.getChildren(item.owningLibrary)
                  .then(function(childItems) {
                    //console.log("Item child count:" + childItems.length);
                    childItems.forEach(function(childItem) {
                      switch (childItem.get("itemType")) {
                        case "attachment":
                        var filename = childItem.get("filename");
                        parentItem.attachments =
                          (parentItem.attachments ? parentItem.attachments.split(/;/) : [])
                          .concat(filename).join(";");
                        break;
                      }
                    });
                    // all children inspected
                    resolve();
                  }).catch(reject);
              }).catch(reject);
              promises.push(p);
            }
            result.push(globalItem);
          });
          // resolve when all child items have been inspected
          return Promise.all(promises);
        })
        .then(function() {
          resolve(result);
        })
        .catch(reject);
      });
    },

    /**
     * Returns the canonical URI to the library
     * @param  {String} libraryType [description]
     * @param  {String} libraryId   [description]
     * @return {String}
     */
    getLibraryUri: function(libraryType, libraryId) {
      return ["https://api.zotero.org", libraryType + "s", libraryId].join("/");
    },

    /**
     * Returns the canonical URI to the item
     * @param  {String} libraryType [description]
     * @param  {String} libraryId   [description]
     * @param  {String} itemKey     [description]
     * @return {String}
     */
    getItemUri: function(libraryType, libraryId, itemKey) {
      return [this.getLibraryUri(libraryType + "s", libraryId), "items", itemKey].join("/");
    },

    /**
     * Checks the source item has already been copied to the target library before
     * and, if so, creates a link to the target collection
     * @param  {Object} source A map with information on the source
     * @param  {Object} target A map with information on the target
     * @return {Promise} A promise that resolves with the key of the existing item
     */
    linkCollectionIfItemExists : function( source, target, itemData ){
      console.debug("zotero::linkCollectionIfItemExists");
      var that = this;
      var sourceLibrary = that.getLibrary(source.type, source.id);
      var targetLibrary = that.getLibrary(target.type, target.id);
      var sourceLibUri  = that.getLibraryUri(source.type, source.id);
      var targetLibUri  = that.getLibraryUri(target.type, target.id);
      var sourceItemKey = itemData.id;
      var targetItemKey = null;
      // check if entry exists
      return sandbox.getDatastore().getTargetKey(sourceLibUri, sourceItemKey, targetLibUri)
      .then(function(itemKey) {
        if ( ! itemKey ) {
          console.debug("Item has not yet been copied to target library.");
          return false;
        } else {
          targetItemKey = itemKey;
          console.debug("Item exists in target library (#" + itemKey + "), linking to collection " + target.collectionKey);
          return that.getLibrary(target.type, target.id).loadItem(targetItemKey);
        }
      })
      .then(function(item){
        // pass on negative result
        if( item === false ) return false;
        if( ! (item instanceof Zotero.Item ) ){
          // item could not be loaded, remove cached link
          console.warn("Loading item failed.");
          return sandbox.getDatastore()
          .removeLink(sourceLibUri, sourceItemKey, targetLibUri, targetItemKey)
          .then(function(){
            return false;
          });
        } else {
          if (item.get("collections").indexOf(targetItemKey) >= 0) {
            console.debug("Item already linked to folder. Nothing to do.");
            return targetItemKey;
          } else {
            console.debug("Linking item to target collection...");
            item.addToCollection(target.collectionKey);
            return item.writeItem()
            .then(function(){
              return targetItemKey;
            });
          }
        }
      })
      .then(function(result) {
        return result;
      });
    },

    /**
     * Creates a new item in the library
     *
     * @param  {String}  libraryType Library type (user/group)
     * @param  {Integer} libraryId   Library id
     * @param  {Object}  itemData    The item data
     * @param  {String}  targetCollectionKey The key of the collection in which the
     * item is to be created. Optional, can also be passed in the target.collectionKey
     * object path in itemDatainfo json data.
     * @return {Promise} A promise resolving with the id of the newly created item
     * or of an item that existed already.
     *
     */
    createItem: function(libraryType, libraryId, itemData, targetCollectionKey) {
      console.debug("zotero::createItem(" + [libraryType, libraryId, "(data)",targetCollectionKey].join(",") + ")");
      var that = this;

      // static vars
      var info = JSON.parse(itemData.info); // TODO
      var source = info.source;
      var target = info.target;
      var sourceLibrary = that.getLibrary(source.type, source.id);
      var targetLibrary = that.getLibrary(libraryType, libraryId);
      var sourceLibUri  = that.getLibraryUri(source.type, source.id);
      var targetLibUri  = that.getLibraryUri(libraryType, libraryId);
      var sourceItemKey = itemData.id;
      targetCollectionKey = targetCollectionKey || info.target.collectionKey; //TODO

      var msg = 'Creating "' + itemData.title + '"';
      console.debug("-".repeat(msg.length));
      console.info(msg);
      console.debug("-".repeat(msg.length));
      // check if item has already been copied to the target
      return this.linkCollectionIfItemExists( source, target, itemData )
      .then(function(targetItemKey){
        if(targetItemKey) {
          return targetItemKey;
        } else {
          // console.debug(itemData);
          // console.debug(info);
          delete itemData.id;
          delete itemData.dateAdded;
          delete itemData.info;
          delete itemData.collections;
          var data = dictionary.translateToLocal(itemData);
          var library = that.getLibrary(libraryType, libraryId);
          var item = new Zotero.Item();
          item.associateWithLibrary(library);
          return item.initEmpty(data.itemType)
          .then(function(item) {
            // collection
            item.addToCollection(targetCollectionKey);
            // notes
            if (data.notes) {
              console.debug("Create notes ....");
              var childNote1 = new Zotero.Item();
              childNote1.initEmptyNote();
              childNote1.set('note', data.notes);
              item.notes = [childNote1];
              delete data.notes;
            }
            // attachments
            if (itemData.attachments) { // TODO: implement adding of attachments
              console.debug("Create attachments ...");
              itemData.attachments.split(";").forEach(function(filename) {
                console.debug("TODO: Not adding attachment " + filename);
              }, this);
            }
            // set properties
            for (var key in data) {
              item.set(key, data[key]);
            }
            // write it to zotero server
            return item.writeItem();
          })
          .then(getItemFromWriteResult)
          //.then(debugResult)
          .then(function saveLink(targetItem) {
            targetItemKey = targetItem.get("key");
            return sandbox.getDatastore().saveLink(
              sourceLibUri, sourceItemKey,
              targetLibUri, targetItemKey
            );
          })
          .then(function(){
            return targetItemKey;
          });
        }
      });
    },

    /**
     * Copies an  item from a (different) zotero library
     *
     * @param  {String}  libraryType Library type (user/group)
     * @param  {Integer} libraryId   Library id
     * @param  {Object}  itemData    The item data
     * @param  {String}  targetCollectionKey The key of the collection in which the
     * item is to be created. Optional, can also be passed in the target.collectionKey
     * object path in itemDatainfo json data.
     * @return {Promise} A promise resolving with the id of the newly created item
     *
     */
    copyItem: function(libraryType, libraryId, itemData, targetCollectionKey) {
      console.debug("zotero::copyItem(" + [libraryType, libraryId, "(data)",targetCollectionKey].join(",") + ")");
      var that = this;
      // static vars
      var info = JSON.parse(itemData.info);
      var source = info.source;
      var target = info.target;
      var sourceLibrary = that.getLibrary(info.source.type, info.source.id);
      var targetLibrary = that.getLibrary(libraryType, libraryId);
      var sourceLibUri  = that.getLibraryUri(info.source.type, info.source.id);
      var targetLibUri  = that.getLibraryUri(libraryType, libraryId);
      var sourceItemKey = itemData.id;
      targetCollectionKey = targetCollectionKey || info.target.collectionKey;

      // these closure variables will be populated in the subfunctions
      var sourceItem = null;
      var targetItem = null;
      var targetItemKey = "";
      var sourceAttachmentItems = [];

      //console output
      var msg = 'Copying "' + itemData.title + '"';
      console.debug("-".repeat(msg.length));
      console.info(msg);
      console.debug("-".repeat(msg.length));
      console.debug(["Source itemKey:", sourceItemKey, "; target collectionKey:", targetCollectionKey].join(" "));

      // check if item has already been copied to the target
      return this.linkCollectionIfItemExists( source, target, itemData )
      .then(function(targetItemKey){
        if(targetItemKey) {
          console.debug("Item already exists in target library, nothing to do...");
          return targetItemKey;
        } else {
          console.debug("Copying from item in source library...");
          return sourceLibrary.loadItem(itemData.id)
          .then(setSourceItemAndCopyToTargetLibrary)
          .then(loadTargetItemFromSendToLibraryResult)
          .then(setTargetItemAndLoadSourceChildItems)
          .then(copyChildItems)
          .then(configureAndWriteTargetItem)
          .then(reloadTargetItem)
          .then(loadTargetChildItems)
          .then(configureAttachments)
          .then(saveLink)
          .then(function() {
            console.debug("Done.");
            return targetItemKey;
          });
        }
      });

      /**
       * Copies the given source item to the target library
       * Also assigns the item to the closure variable sourceItem
       * @param  {Zotero.item} item Source item
       * @return {Promise} Promise that resolves with the (incomplete)
       * copied item in the path [0].returnItems[0]
       */
      function setSourceItemAndCopyToTargetLibrary(item) {
        console.debug("Copying item to target library...");
        sourceItem = item;
        return sourceLibrary.sendToLibrary([sourceItem], targetLibrary);
      }

      /**
       * Retrieves the key of the target item from the result of
       * a Zotero.Item.prototype.sentToLibrary result and loads the item.
       * Also assigns the key to the sourceItem closure variable
       * @param  {Object} result
       * @return {Promise} A promise that resolves with a Zotero.Item instance
       */
      function loadTargetItemFromSendToLibraryResult(result) {
        targetItemKey = result[0].returnItems[0].get("key");
        console.debug("Target item key is " + targetItemKey);
        return targetLibrary.loadItem(targetItemKey);
      }

      /**
       * Assigns the passed Zotero.Item to the targetItem closure variable,
       * then loads the children of the source item.
       * @param {Zotero.Item} The (incomplete) targetItem
       * @return {Promise|false} A Promise that resolves with an array containing
       * instances of Zotero.Item or false if something went wrong.
       */
      function setTargetItemAndLoadSourceChildItems(item) {
        if (!item) {
          console.warn("Error creating item.");
          return null;
        } else {
          targetItem = item;
          return sourceItem.getChildren(targetLibrary);
        }
      }

      /**
       * Reload the copied item from the target database. Relies on the targetItemKey
       * closure variable to be set
       * @return {Promise} A Promise that resolves with the reloaded target item
       */
      function reloadTargetItem() {
        return targetLibrary.loadItem(targetItemKey);
      }

      /**
       * Reload the given item from the target database
       * @param {Zotero.Item}
       * @return {Promise} A Promise that resolves with the reloaded item
       */
      function reloadItem(item) {
        var itemKey = item.get("key");
        console.debug("Reloading item #" + itemKey);
        return targetLibrary.loadItem(itemKey);
      }

      function debugItem(item) {
        if ( item instanceof Zotero.Item ){
          console.debug(item.apiObj.data);
        } else {
          console.debug(item);
        }
        return item;
      }


      /**
       * Creates copies of child items. Implemented so far:
       *  - file attachments
       *  - notes
       * @param  {Zotero.Items[]} childItems An array of child items
       * @return {Promise}   A promise that resolves when all child items copies are
       *                     created.
       */
      function copyChildItems(childItems) {
        if( ! childItems ){
          // pass on negative result
          return false;
        }
        console.log("Copying child items to target library...");
        // console.log("=== sourceChildItems ===");
        // console.dir(childItems.map(function(item){return item.apiObj.data;}));
        var childItemPromises = [];
        targetItem.attachments = [];
        targetItem.notes = [];

        childItems.forEach(function(childItem) {
          var item = new Zotero.Item(),
            p, keys;
          var itemType = childItem.get("itemType");
          var linkMode = childItem.get("linkMode");
          var extendedItemType = itemType + (linkMode ? "/" + linkMode : "");
          switch (extendedItemType) {
            case "attachment/imported_file":
            case "attachment/imported_url":
              // TODO: Implement
              if (childItem.get("title").search(/snapshot/i) >-1 ) {
                console.log("Skipping " + childItem.get("title"));
                return;
              }
              console.log("Adding file attachment " + childItem.get("title"));
              p = item.initEmpty('attachment', "imported_file")
              .then(function(attachmentItem) {
                ["title", "contentType", "charset", "filename", "url"].forEach(function(key) {
                  attachmentItem.set(key, childItem.get(key));
                });
                attachmentItem.set('parentItem', targetItem.get("key"));
                attachmentItem.associateWithLibrary(targetLibrary);
                sourceAttachmentItems.push(childItem);
                targetItem.attachments.push(attachmentItem);
              });
              childItemPromises.push(p);
              break;
            case "note":
              console.log("Adding note " + childItem.get("title"));
              p = item.initEmpty('note')
                .then(function(noteItem) {
                  keys = ["title", "note", "tags", "relations", "contentType", "charset"];
                  keys.forEach(function(key) {
                    noteItem.set(key, childItem.get(key));
                  });
                  noteItem.set('parentItem', targetItem.get("key"));
                  noteItem.associateWithLibrary(targetLibrary);
                  targetItem.notes.push(noteItem);
                });
              childItemPromises.push(p);
              break;
            default:
              console.log("Skipping " + extendedItemType + " " + childItem.get("title"));
          } // end switch
        }); // end forEach
        return Promise.all(childItemPromises)
        .then(function(){
          console.debug("Done creating child items.");
        });
      }

      /**
       * Adds the copied item to the target collection and add some properties.
       * @return {Promise} A pormise that resolves when the item has been written
       * to the database
       */
      function configureAndWriteTargetItem(result) {
        if(result===false){
          return false;
        }
        console.debug("Saving and adding item to collection #" + targetCollectionKey);
        targetItem.addToCollection(targetCollectionKey);
        targetItem.associateWithLibrary(targetLibrary);
        return targetItem.writeItem();
      }

      /**
       * Load the children of the given item and return them. This also assigns
       * the passed item to the targetItem closure variable
       * @param  {Zotero.Item} item The
       * @return {Promise} A Promise that resolves with an array containing
       * instances of Zotero.Item
       */
      function loadTargetChildItems(item) {
        if(item===false){
          return false;
        }
        targetItem = item;
        return targetItem.getChildren(targetLibrary);
      }


      /**
       * Configures the child attachments of the target item after they
       * have been saved on the server. Calls module that transfers the
       * files connected with the attachment items
       * @return {Promise}      A promise that resolves when all the child items
       *                        have been configured
       */
      function configureAttachments(targetChildItems) {
        if(targetChildItems===false){
          return false;
        }
        console.debug("Configuring attachments ...");
        if( targetChildItems.length === 0 ){
          console.debug("No child attachments.");
          return Promise.resolve();
        }
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
              ["note", "tags", "md5", "mtime"].forEach(function(key) {
                targetChildItem.set(key, sourceAttachmentItem.get(key));
              });
              var href = ["https://api.zotero.org", info.source.type, info.source.id,
                "items", sourceAttachmentItem.get("key")].join("/");
              targetChildItem.set('relations', {
                "owl:sameAs": href
              });
              return targetChildItem.writeItem()
              .then(getItemFromWriteResult)
              .then(function(item){
                if( item ){
                  console.debug("Attachment item written to server, key is " + item.get("key") );
                  return attachmentManager.transferFile(info, sourceAttachmentItem, item )
                  .then(function(success){
                    if (success) {
                      console.debug("Attachment sucessfully transferred.");
                    } else {
                      console.debug("Problem transferring the attachment.");
                    }
                    return Promise.resolve();
                  });
                } else {
                  console.warn("Problem writing child item to server");
                  return Promise.resolve();
                }
              });
            });
            default:
            console.debug("Ignoring attachment " + targetChildItem.get("title") );
            return Promise.resolve();
          }

        }, Promise.resolve());
      }

      function saveLink(result) {
        if(result===false){
          return false;
        }
        return sandbox.getDatastore().saveLink(
          sourceLibUri, sourceItemKey,
          targetLibUri, targetItem.get("key")
        );
      }
    },

    updateItem: function(libraryType, libraryId) {
      console.debug("zotero::updateItem(" + [libraryType, libraryId, "(data)"].join(",") + ")");
      console.warn("Update item not implemented, ignoring request ... ");
      return Promise.resolve("not implemented");
    },

    removeCollectionItem: function(libraryType, libraryId) {
      console.debug("zotero::removeCollectionItem(" + [libraryType, libraryId, "(data)"].join(",") + ")");
      console.warn("Remove item not implemented, ignoring request ... ");
      return Promise.resolve("not implemented");
    }
  };
};
