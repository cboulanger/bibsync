var _         = require("underscore");

/**
 * BibSync service methods
 * @param  {Object} sandbox An object exposing the application API
 * @return {Object} An object exposing the service methods
 */
module.exports = function(sandbox)
{

  var console = sandbox.getConsole();
  var config  = sandbox.getConfig();
  var success = sandbox.success;
  var fail    = sandbox.fail;
  var enabledAPIs = sandbox.getEnabledApis();

  /**
   * In-memory cache
   * @type {Object}
   */
  var cache = {};

  /*
   Observe progress widget's cancel button
   TODO solve this in a more generic way
   */
  var cancelAction = false;
  sandbox.getSocket().on('connection', function (socket) {
    socket.on("progress.cancel", function () {
      cancelAction = true;
    });
  });

  // Services
  var services = {
    /**
     * Return data on available libraries
     * /libraries
     * @param  {Object} req Express request Object
     * @param  {Object} res Express response Object
     * @return {void}
     */
    libraries: function(req, res) {
      var promises = [];
      for (var key in enabledAPIs) {
        promises.push(enabledAPIs[key].getLibraries());
      }
      Promise.all(promises)
        .then(function(values) {
          res.json(values.reduce(function(result, current) {
            return result.concat(current);
          }, []));
        })
        .catch(fail(res));
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
      console.debug("Sync action: " + action);

      var info = services._getParameterObject(req);
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
            };

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
     * @param  {Object} info An object containing all information
     * @return {Promise}
     */
    copyFolder : function(info) {
      var source = info.source;
      var target = info.target;
      //console.debug(info);
      if ( info === false ) {
        return res.status(400).send("Source and target are identical");
      }
      var sourceApi = enabledAPIs[source.application];
      var targetApi = enabledAPIs[target.application];
      if( ! sourceApi || ! targetApi ){
        return Promise.reject(new Error("Invalid application"));
      }
      sandbox.showProgress(0,"Assembling information...");
      var targetCollectionKey = null;
      return sourceApi.getCollection(source.type,source.id,source.collectionKey)
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
        // serially iterate over data using promise-returning functions and array.prototype.reduce:
        // http://taoofcode.net/promise-anti-patterns/
        var numItems = items.length;

        return items.reduce(function( promise, itemData, index ){
          return promise.then(function(){
            // user pressed "cancel" button
            if( cancelAction ){
              console.info("User cancelation...");
              sandbox.showProgress( (index/numItems)*100, "Aborting...");
              return Promise.resolve();
            }
            // continue
            sandbox.showProgress(
              (index/numItems)*100,
              "Copying " + (index+1) + " of " + numItems + " items.",
              itemData.title
            );
            itemData.info = JSON.stringify( info ); // TODO: info should be passed as parameter, this requires changeing the REST API as well
            if( source.application == target.application ){
              return targetApi.copyItem( target.type, target.id, itemData, targetCollectionKey );
            } else {
              return targetApi.createItem( target.type, target.id, itemData, targetCollectionKey );
            }
          });
        }, Promise.resolve());
      })
      .then(function(){
        sandbox.hideProgress();
        sandbox.hideProgress();
        cancelAction=false; // important!
        console.debug("Done.");
      })
      .catch(function(err){
        sandbox.hideProgress();
        sandbox.hideProgress();
        console.error(""+err);
      });
    },

    /**
     * TESTs
     * @type {Object}
     */
    test : function(){

      ///zotero/group/984485/items
      var info = {
        "source": {
          "application": "bookends",
          "id": 0,
          "type": "user",
          "collectionKey": "1b7185cec28a1e20e33f5f3ad0f02081"
        },
        "target": {
          "application": "zotero",
          "id": 984485,
          "type": "group",
          "collectionKey": "3VKSCZXV"
        }
      };
      var itemData = {
        itemType:"bookSection",
        authors:"Luhmann, Niklas",
        title:"Positives Recht und Ideologie",
        bookTitle:"Soziologische Aufklärung 2. Aufsätze zur Theorie der Gesellschaft",
        pages:"178-203",
        date:"1991",
        publisher:"Westdeutscher Verlag",
        place:"Opladen",
        key:"Luhmann-1991-Positives",
        pubmedId:"3355",
        attachments:"Luhmann-1991-Positives.pdf",
        dateAdded:"2011-08-26",
        collections:"Autonomy of Law;Ideology",
        info : JSON.stringify( info ) // TODO this is dumb
      };
      var target = info.target;
      enabledAPIs[ target.application]
        .createItem( target.type, target.id, itemData, target.collectionKey );
    }

  };
  return services;
};
