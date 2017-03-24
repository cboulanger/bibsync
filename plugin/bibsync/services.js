var _         = require("underscore");
var config    = require("../../config.js");

// load custom console
var console = config.getConsole();

/**
 * Module
 * @type {Object}
 */
module.exports = (function(){

  /**
   * Factory function that returns the function for the .catch() method
   * of a promise
   * @param  {Object}   res The express response object
   * @return {Function} A function that sends a HTTP error response
   */
  function fail(res){
    return function( error ){
      console.warn(""+err);
      res.status(500).send(""+err);
    };
  }

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

  // API
  return {
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
     * Create a clean parameter object from the request parameters with information
     * on the source and target. Returns boolean false if source and target are identical
     *
     * @param  {Object} req Express request Object
     * @return {Object|false}
     */
    _getParameterObject : function(req)
    {
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
      if( match ) return false;
      return info;
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
      var that = module.exports;

      console.debug("Sync action: " + action);

      var info = that._getParameterObject(req);
      if ( info === false ) {
        return res.json({
          responseAction : "error",
          responseData   : "Source and target are identical",
          action         : ""
        });
      }

      //console.debug(info);
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

      function abort(err)
      {
        console.warn(""+err);
        res.status(500).send(""+err);
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
            console.info("Syncing collection content...");

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
                var keysToIgnore = ["id","dateAdded","version"];
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
    },

    /**
     * Copy one folder and its contents as a subfolder of another folder
     * /copy/:sourceApplication/:sourceType/:sourceId/:sourceCollectionKey/
     *    to/:targetApplication/:targetType/:targetId/:targetCollectionKey/
     * @param  {Object} req Express request Object
     * @param  {Object} res Express response Object
     * @return {void}
     */
    copyFolder : function(req, res) {
      var that = module.exports;
      var info = that._getParameterObject(req);
      var source = info.source;
      var target = info.target;

      //console.debug(info);
      if ( info === false ) {
        return res.status(400).send("Source and target are identical");
      }

      var sourceApi = enabledAPIs[source.application];
      var targetApi = enabledAPIs[target.application];
      if( ! sourceApi || ! targetApi ){
        return res.status(400).send("Invalid application");
      }
      var targetCollectionKey = null;
      sourceApi.getCollection(source.type,source.id,source.collectionKey)
      .then(function(collection){
        var data = {
          name      : collection.name,
          parentKey : target.collectionKey
        };
        console.log("Writing collection '" + collection.name + "' to the server" );
        return targetApi.addCollection(target.type,target.id,data);
      })
      .then(function(newCollectionKey){
        console.debug("Received new collection key " + newCollectionKey );
        targetCollectionKey = newCollectionKey;
        console.debug("Loading source items...");
        return sourceApi.getCollectionItems( source.type, source.id, source.collectionKey );
      })
      .then(function(items){
        console.debug("Creating copies in target collection...");
        var p, promises = [];
        items.forEach(function( itemData ){
          itemData.info = JSON.stringify( info ); // TODO
          if( source.application == target.application ){
            p = targetApi.copyItem( target.type, target.id, itemData, targetCollectionKey );
          } else {
            p = targetApi.createItem( target.type, target.id, itemData, targetCollectionKey );
          }
          promises.push(p);
        });
        // return promises.reduce(function(previous,promise,index){
        //   previous.then(function(){
        //     console.log("+++++ Executing promise +++++ "+ index );
        //     return promise;
        //   });
        // }, Promise.resolve());
        return Promise.all(promises);
      })
      .then(function(){
        console.debug("Done.");
        res.status(200).send();
      })
      .catch(function(err){
        console.error(""+err);
        res.status(500).send(""+err);
      });
    }
  };
})();
