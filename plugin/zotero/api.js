var Zotero      = require('libzotero');
var Promise     = require('promise');
var JsonClient  = require('json-client');
var _           = require("underscore");
var config      = require('../../config');

var userLibrary   = new Zotero.Library("user", config.zotero.userId, "", config.zotero.apiKey);
var zoteroServer  = new JsonClient("https://api.zotero.org/");

//Zotero.preferences.setPref("debug_level", 1);

// setup mappings:
var global_map    = require('../bibsync/map');
var global_types  = global_map.types;
var global_fields = global_map.fields;
var local_map     = require('./map');
var local_types   = _.invert(local_map.types);
var local_fields  = _.invert(local_map.fields);

//console.log( "\n\nzotero_fields:");
//console.dir(zotero_fields);

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
   * Given a global field name, return the local field name
   * @param  {String} globalField The name of the global field
   * @param  {Map} data        The reference data
   * @return {String}
   */
  getLocalField: function(globalField, data) {
    if (typeof local_map.fields[globalField] == "function") {
      return local_map.fields[globalField](data);
    }
    return local_map.fields[globalField];
  },

  /**
   * Given a local field name, return the global field name
   * @param  {String} localField The name of the local field
   * @param  {Map} data        The reference data
   * @return {String}
   */
  getGlobalField: function(localField, data) {
    if (typeof local_fields[localField] == "function") {
      return local_fields[localField](data);
    }
    return local_fields[localField];
  },

  /**
   * Return the field name that is used to store a unique id that is used for synchronization
   * @return {String}
   */
  getSyncIdField : function(){
    return "key";
  },

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
   * @param type {String} "user" | "group", ignored here
   * @param libId {Integer} Numeric id of library, ignored here
   * @param collectionKey {String} Key of the collection
   * @param fields [Array] Optional array of fields to use. If omitted, all
   *  fields are used.
   * @return {Promise} resolves with an Array of maps containing the collection
   *    data
   */
  getCollectionItems: function(type, libraryId, collectionKey, fields) {
    console.log("zotero::getCollectionItems("+[type, libraryId, collectionKey].join(",")+")");
    var that = this;
    return new Promise(function(resolve, reject) {
      var library = that.getLibrary(type, libraryId);
      library.loadItems({
        collectionKey: collectionKey
      }).then(function(data) {
        var result = [];
        data.loadedItems.forEach(function(item){
          var newItem = {};
          if ( fields instanceof Array && fields.length )
          {
            fields.forEach(function(field){
              newItem[field] = item.get( that.getLocalField(field) || field);
            });
          } else {
            for (var key in item.apiObj.data )
            {
              var globalField = that.getGlobalField(key);
              if ( globalField ){
                newItem[globalField] = item.apiObj.data[key];
              }
            }
          }
          newItem.syncId = item.key;
          result.push(newItem);
        });
        resolve(result);
      }).catch(reject);
    });
  },

  /**
   * Returns the dates when the references with the given ids were last modified
   * @param  {Array} ids An array of numeric ids
   * @return {Promise} A Promise resolving with an array of Date objects
   */
  getModificationDates: function(ids) {
    if (!(ids instanceof Array)) throw new Error("ids must be an array.");
    throw new Error("Not implemented.");
  }
};
