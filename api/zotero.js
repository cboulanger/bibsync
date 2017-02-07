'esversion:6';

var Zotero  = require('libzotero');
var Promise = require('promise');
var JsonClient = require('json-client');

var types   = require("../mappings/types");
var fields  = require("../mappings/fields");

var config = require('../config');
Zotero.preferences.setPref("debug_level",1);

var userLibrary = new Zotero.Library("user", config.zotero.userId, "", config.zotero.apiKey);
var groupLibraries = [];

var zoteroServer = new JsonClient("https://api.zotero.org/");


module.exports = {

   makeApiCall : function( call, params ){
     return zoteroServer('get', call + "?key=" + config.zotero.apiKey + ( params ? "&" + params : "" ) );
   },

    getUserLibrary : function() {
      return userLibrary;
    },

    getGroupLibrary : function( groupId ) {
        var groupLibrary = groupLibraries[groupId];
        if ( groupLibrary === undefined ) {
          groupLibrary = new Zotero.Library("group", groupId, "", config.zotero.apiKey);
          groupLibraries[groupId] = groupLibrary;
        }
        return groupLibrary;
    },

    getLibraries : function(){
      var that=this;
      return new Promise(function(resolve,reject){
        that.makeApiCall("users/"+ config.zotero.userId + "/groups")
          .then(function(result){
            result = result.map(function(elem){return elem.data;});
            resolve(result);
          })
          .catch(function(err){reject(err);});
      });

    },

    getLibrary : function( type, libId ){
      if ( type == "user" ) return this.getUserLibrary();
      return this.getGroupLibrary( libId );
    },

    getCollections : function( type, libId ){
      var that= this;
      return new Promise(function(resolve, reject) {
        try{
        var library = that.getLibrary( type, libId );
        library
          .loadUpdatedCollections()
          .then(function(result){
            var collectionObjects = library.collections.collectionObjects;
            var collections = {};
            var colllection;
            for( var key in collectionObjects )
            {
              colllection = library.collections.getCollection(key);
              collections[key]= {
                key: key,
                name: colllection.apiObj.data.name,
                parent: colllection.apiObj.data.parentCollection,
                version: colllection.apiObj.version
              };
            }
            resolve(collections);
          }).
          catch(function(err){
            console.warn(err);
            reject(err);
          });
        }catch(e){ reject(e); }
      });
    },

    getCollectionItems : function( type, libraryId, collectionKey)
    {
      var that= this;
      return new Promise(function(resolve, reject) {
        try{
        var library = that.getLibrary( type, libraryId );
        library.loadItems({
            collectionKey:collectionKey
        }). then(function(data){
          response = [];
          data.loadedItems.forEach(function(it){
            response.push({
              authors: it.get('creatorSummary'),
              title: it.get('title'),
              date: it.get('year')
            });
          });
          resolve(response);
        })
        .catch(function(err){
            console.warn(err);
            reject(err);
          });
        }catch(e){ reject(e); }
      });
    }
};
