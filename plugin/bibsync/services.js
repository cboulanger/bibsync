var _       = require("underscore");
var Promise = require('promise');
var config  = require("../../config.js");

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
   * Return the data of available libraries
   * /sync/libraries
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

    // create folders/collections

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

    function syncAction(data)
    {
      info.source.collections = data[0];
      info.source.collection  = data[1];
      info.source.collection.children =
        sourceApi.getCollectionChildKeysSync( info.source.type, info.source.id, info.source.collectionKey );

      info.target.collections = data[2];
      info.target.collection  = data[3];
      info.target.collection.children =
        targetApi.getCollectionChildKeysSync( info.target.type, info.target.id, info.target.collectionKey );

      var sourceChildKeys = info.source.collection.children;
      var targetChildKeys = info.target.collection.children;

      switch (action) {
        case "start":
          if ( info.source.collection.name !== info.target.collection.name  ){
            return res.json({
              responseAction : "confirm",
              responseData   : "Collections have different names, continue?",
              action         : "startSyncCollections"
            });
          }
          // fallthrough if names match
          //
        /*
          compare source and target subcollections
         */
        case "startSyncCollections":
          console.log("Starting sync'ing of collections...");
          var diff = sourceChildKeys.length - targetChildKeys.length;
          if( diff > 0 ) {
            if( ! targetApi.canCreateCollection() ){
              // cannot create subcollections
              console.log("Target cannot create folders.");
              return res.json({
                responseAction : "confirm",
                responseData   : "The source collection has at least " + diff + " subcollections which cannot be created on the target. Continue anyways?",
                action         : "syncCollectionItems"
              });
            }
            // will create subcollections
            console.log("Ask user if subcollections should be created.");
            return res.json({
              responseAction : "confirm",
              responseData   : "The source collection has at least " + diff + " subcollections which do not exist in the target. Create?",
              action         : "syncCollectionsCreateChildren"
            });
          }
          // fallthrough to next case
        /*
          ask the user if collections should be created
         */
        case "syncCollectionsCreateChildren":
          console.log("User needs to confirm that subcollections should be created and populated.");
          var difference = _.difference(sourceChildKeys,targetChildKeys);
          var names=[];
          difference.forEach(function(collectionKey){
            var sourceCollection = sourceApi.getCollectionSync( info.source.type, info.source.id, collectionKey );
            names.push(sourceCollection.name);
          });
          return res.json({
            responseAction : "confirm",
            responseData   : "The following collections will be created: " + names.join(", ") + ". Proceed?",
            action         : "syncCollectionsCreateChildrenConfirmed"
          });

          break;
        /*
          create the collections
         */
        case "syncCollectionsCreateChildrenConfirmed":
        console.log("Not creating subcollections... Needs to be implemented");
          // var collectionKeys = [];
          // _.difference(sourceChildKeys,targetChildKeys).forEach(function(collectionKey){
          //   var sourceCollection = sourceApi.getCollectionSync( info.source.type, info.source.id, collectionKey );
          //   var data = {
          //     name : sourceCollection.name,
          //     parent: info.target.collection.key
          //   };
          //   var key = targetApi.addCollectionLocallySync( data );
          //   collectionKeys.push(key);
          // });
        // fallthrough
        //
        /*
          sync the content of the collection
         */
        case "syncCollectionItems":
          console.log("Sync'ing collection content...");

          Promise.all([
            sourceApi.getCollectionItems( info.source.type, info.source.id, info.source.collectionKey ),
            targetApi.getCollectionItems( info.target.type, info.target.id, info.target.collectionKey )
          ]).then(function(data){
            var identifiers=[[],[]];
            for(var i=0;i<2;i++){
              identifiers[i]=data[i].map(function(item){
                return item.syncId ? item.syncId: item.title;
              });
            }
            var diff = _.difference(identifiers[0],identifiers[1]),
                same = _.intersection(identifiers[0],identifiers[1]);

            cache[info.source.collectionKey+info.target.collectionKey] = {
              diff : diff,
              same : same
            };

            return res.json({
              responseAction : "confirm",
              responseData   : "Add " + diff.length + " items to the target collection?",
              action         : "addItemsToTargetCollection"
            });
          }).catch(abort);
          break;

        case "addItemsToTargetCollection":

        return res.json({
          responseAction : "alert",
          responseData   : "Done!",
          action         : ""
        });


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
