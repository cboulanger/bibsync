var _         = require("underscore");
var Promise   = require('promise');
var config    = require("../../config.js");


/**
 * The available API objects
 * @type {Object}
 */
var enabledAPIs = {};
for (var key in config) {
  if (config[key].enabled) {
    enabledAPIs[key] = require("../" + key + "/api");
  }
}

/**
 * In-memory cache
 * @type {Object}
 */
var cache = {};

/**
 * Module
 * @type {Object}
 */
module.exports = {

  /**
   * Return data on available libraries
   * /libraries
   * @param  {Object} req Express request Object
   * @param  {Object} res Express response Object
   * @return {void}
   */
  libraries: function(req, res) {
    var promises = [];
    for (key in enabledAPIs) {
      promises.push(enabledAPIs[key].getLibraries());
    }
    Promise.all(promises)
      .then(function(values) {
        res.json(values.reduce(function(result, current) {
          return result.concat(current);
        }, []));
      })
      .catch(function(err) {
        res.status(500).send(err);
      });
  },

  /**
   * Start the syncronization
   * /sync/:sourceApplication/:sourceType/:sourceId/:sourceCollectionKey/
   *   to/:targetApplication/:targetType/:targetId/:targetCollectionKey/:action
   * @param  {Object} req Express request Object
   * @param  {Object} res Express response Object
   * @return {void}
   */
  startSync: function(req, res) {

    var action = req.params.action;
    console.log("=== Sync action " + action + " ===");

    // create a clean parameter object
    var info = {
      source: {},
      target: {}
    };
    var props = "application,type,id,collectionKey".split(/,/);
    for (var key in info) {
      info[key] = {};
      props.forEach(function createProperty(prop) {
        var param = key + prop[0].toUpperCase() + prop.substring(1);
        info[key][prop] = req.params[param];
      });
    }

    var match = true;
    for( key in info.source )
    {
      if ( info.source[key] != info.target[key] ) match = false;
    }
    if ( match ) {
      return res.json({
        responseAction : "error",
        responseData   : "Source and target are identical",
        action         : ""
      });
    }

    //console.dir(info);

    var sourceApi = enabledAPIs[info.source.application];
    var targetApi = enabledAPIs[info.target.application];
    if( ! sourceApi || ! targetApi ){
      return res.status(400).send("Invalid application");
    }

    // assemble all information needed

    // get data from cache if possible
    var cacheId = [
      info.source.type, info.source.id, info.source.collectionKey,
      info.target.type, info.target.id, info.target.collectionKey ].join("|");
    cache[cacheId] = {
      collectionData : null,
      childCollectionDiff : null
    };
    if ( cache[cacheId].collectionData )
    {
      return syncAction( cache[cacheId].collectionData );
    }

    // get data from backends
    Promise.all([
      sourceApi.getCollections  ( info.source.type, info.source.id ),
      sourceApi.getCollection   ( info.source.type, info.source.id, info.source.collectionKey ),
      targetApi.getCollections  ( info.target.type, info.target.id ),
      targetApi.getCollection   ( info.target.type, info.target.id, info.target.collectionKey )
    ])
      .then( syncAction )
      .catch( abort );

    var that = this;

    function abort(err)
    {
      console.warn(err);
        res.status(500).send(err);
    }

    /**
     * Compares two javascript objects by comparing selected properties
     * @param  {Object} item1           First ob
     * @param  {Object} item2           Second object
     * @param  {Array} fieldsToCompare An array of strings with the property names
     * @return {Boolean}                 Whether all properties match or not
     */
    function itemCompare ( item1, item2, fieldsToCompare )
    {
      return fieldsToCompare.every(function(field){
        return item1[field] == item2[field];
      });
    }

    /**
     * Compares two collections in the form of javascript arrays containing
     * javascript objects by comparing selected properties
     * of these objects.
     * @param  {Array} arr1 First collection
     * @param  {Array} arr2 Second collection
     * @param  {Array} fieldsToCompare An array of strings with the names of the
     * properties
     * @return {Array} Returns an array with items of the following structure
     * [ [ index1, item1 ], [index2, item2 ] ]. If the "same" object is present
     * in both collections, all elements of this structure exist. If it is only
     * present in the first or the second collection, only those elements are
     * populated, the other element is set with [null, null];
     */
    function itemsDiff ( arr1, arr2, fieldsToCompare )
    {
      var result = [];

      // common + removed right
      arr1.forEach(function(item1,index1){
        index2 = arr2.findIndex(function(item2){
          return itemCompare(item1,item2,fieldsToCompare);
        });
        if(index2 > -1) {
          result.push([[index1,item1],[index2,arr2[index2]]]);
        } else {
          result.push([[index1,item1],[null, null]]);
        }
      });

      // added right
      arr2.forEach(function(item2,index2){
        index1 = arr1.findIndex(function(item1){
          return itemCompare(item1,item2,fieldsToCompare);
        });
        if(index1 == -1) result.push([[null, null],[index2,item2]]);
      });
      return result;
    }

    /**
     * Transforms a native object with key-value-pairs into a qooxdoo data Array
     * containing qooxdoo objects with a "key" and a "value" property
     * @param  {Object|null} item The javascript object. If a falsy value is
     * passed, an empty array is returned.
     * @param {Array|undefined} keysToIgnore Optional array containing the names
     * of keys that should not be included in the return value
     * @return {qx.data.Array}
     */
    function keyValueize( item, keysToIgnore ){
      if ( ! item ) return [];
      return Object.keys(item)
        .filter(function(key){
          return ((keysToIgnore||[]).indexOf(key) == -1);
        })
        .map(function(key){
          return { key : key , value : item[key] };
        });
    }


    /**
     * Main synchronization process
     * @param  {Array} data
     * @return {void}
     */
    function syncAction(data)
    {
      // save to cache
      cache[cacheId].collectionData = data;

      info.source.collections = data[0]; // all collections in the source library
      info.source.collection  = data[1]; // the data of the specific collection to be synchronized
      info.target.collections = data[2];
      info.target.collection  = data[3];

      info.source.collection.children =
        sourceApi.getCollectionChildKeysSync( info.source.type, info.source.id, info.source.collectionKey );
      info.target.collection.children =
        targetApi.getCollectionChildKeysSync( info.target.type, info.target.id, info.target.collectionKey );

      var sourceChildKeys = info.source.collection.children;
      var targetChildKeys = info.target.collection.children;

      /*
        Action switch
       */
      switch (action) {

        /*
          START
         */
        case "start":
          if ( info.source.collection.name !== info.target.collection.name  ){
            return res.json({
              responseAction : "confirm",
              responseData   : "Collections have different names, continue?",
              action         : "startSyncCollections"
            });
          }

          // fallthrough if names match

        /*
          compare source and target subcollections
         */
        case "startSyncCollections":
        //
        //   console.log("Starting sync'ing of collections...");
        //   var diff = sourceChildKeys.length - targetChildKeys.length;
        //   if( diff > 0 ) {
        //     if( ! targetApi.canCreateCollection() ){
        //       // cannot create subcollections
        //       console.log("Target cannot create folders.");
        //       return res.json({
        //         responseAction : "confirm",
        //         responseData   : "The source collection has at least " + diff + " subcollections which cannot be created on the target. Continue anyways?",
        //         action         : "syncCollectionItems"
        //       });
        //     }
        //
        //     // will create subcollections
        //     console.log("Ask user if subcollections should be created.");
        //     return res.json({
        //       responseAction : "confirm",
        //       responseData   : "The source collection has at least " + diff + " subcollections which do not exist in the target. Create?",
        //       action         : "syncCollectionsCreateChildren"
        //     });
        //   }
        //   // fallthrough to next case
        //
        // /*
        //   ask the user if collections should be created
        //  */
        // case "syncCollectionsCreateChildren":
        //   console.log("User needs to confirm that subcollections should be created and populated.");
        //
        //   var sourceChildCollections = sourceChildKeys.map(function(collectionKey){
        //     return sourceApi.getCollectionSync( info.source.type, info.source.id, collectionKey );
        //   },this);
        //
        //   var targetChildCollections = targetChildKeys.map(function(collectionKey){
        //     return targetApi.getCollectionSync( info.target.type, info.target.id, collectionKey );
        //   },this);
        //
        //   var childCollectionsDiff = itemsDiff(sourceChildCollections,targetChildCollections,["name"]);
        //   cache[cacheId].childCollectionDiff = childCollectionsDiff;
        //
        //   var newCollectionNames = childCollectionsDiff.reduce(function(acc,item){
        //     if( item[0][1] && ! item[1][1] ) {
        //       acc.push( item[0][1].name );
        //     }
        //     return acc;
        //   },[]);
        //
        //   if( newCollectionNames.length )
        //   {
        //     return res.json({
        //       responseAction : "confirm",
        //       responseData   : "The following collections will be created: " + newCollectionNames.join(", ") + ". Proceed?",
        //       action         : "syncCollectionsCreateChildrenConfirmed"
        //     });
        //   }
        //
        //   // fallthrough
        // /*
        //   create the collections
        //  */
        // case "syncCollectionsCreateChildrenConfirmed":
        //
        //   var newChildCollections = cache[cacheId].childCollectionsDiff.reduce(function(acc,item){
        //     if( item[0][1] && ! item[1][1] ) {
        //       acc.push( item[0][1] );
        //     }
        //     return acc;
        //   },[]);
        //
        //   //... implement ...
        //
        // // fallthrough
        // //
        /*
          sync the content of the collection
         */
        case "syncCollectionItems":
          console.log("Syncing collection content...");

          Promise.all([
            sourceApi.getCollectionItems(
              info.source.type, info.source.id, info.source.collectionKey ),
            targetApi.getCollectionItems(
              info.target.type, info.target.id, info.target.collectionKey )
          ])
          .then(function(data){

            var result = itemsDiff(
              data[0],
              data[1],
              [ "title", "date" ]
            );

            var tableData = [];
            result.forEach(function(tuple){
              var index1 = tuple[0][0];
              var item1  = tuple[0][1];
              var index2 = tuple[1][0];
              var item2  = tuple[1][1];

              var keys = _.union( _.keys(item1), _.keys(item2) );
              var keysToIgnore = ["id","dateAdded"];
              var comparedKeys = _.difference( keys, keysToIgnore );

              // skip items if identical
              if( comparedKeys.every(function(key){
                if( !item1 || !item2 ) return false;
                return item1[key] == item2[key];
              })) return;

              // not identical
              tableData.push([
                keyValueize(item1),
                keyValueize(item2),
                keys
              ]);
            });

            // delete cache
            delete cache[cacheId];

            // send items to client
            return res.json({
              responseAction : "startManualSync",
              responseData   : tableData,
              action         : ""
            });

          }).catch(abort);
          break;

        default:
          return res.json({
            responseAction : "alert",
            responseData   : "Unknown action: "+action,
            action         : ""
          });
      }
    }
  }
};
