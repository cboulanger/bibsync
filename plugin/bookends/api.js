var osascript     = require('node-osascript');
var md5           = require('md5');
var _             = require("underscore");

/**
 * Bookends API
 * Uses code by ComplexPoint on
 * https://www.sonnysoftware.com/phpBB3/viewtopic.php?f=2&t=4017
 * @param  {Object} sandbox An object exposing the BibSync API
 * @return {Object} An object exposing API methods
 */
module.exports = function(sandbox)
{
  var dictionary   = sandbox.getGlobalDictionary(require('./dictionary'));
  var config       = sandbox.getConfig();
  var datastore    = sandbox.getDatastore();
  var console      = sandbox.getConsole();

  /**
   * Given an event code, return the AppleScript command
   * @param  {String} eventCode
   * @return {String}
   * TODO : move into module
   */
  function eventCode(eventCode) {
    return 'tell application "Bookends" to «event ToyS' + eventCode + '»';
  }

  /**
   * Execute a command via OSA and process the result
   * @param OSACommand {String}
   * @param splitChar {String|false|undefined}
   *    If string, split the result at the occurrences of this string
   *    If false, split by "\r" and re-join with "\n"
   *    If undefined, split with "\r"
   * @return {String}
   * TODO : move into module
   */
  function evalOSA(OSACommand, splitChar, transformFunc) {
    return new Promise(function(resolve, reject) {
      console.debug(OSACommand);
      try
      {
        osascript.execute(OSACommand, {},
          function(err, result, raw) {
            if ( (result||"").indexOf("No Bookends library window is open") !== -1) {
              err = "No Bookends library window is open";
            }
            if ( err ) {
              return reject(err);
            }
            // transform
            if (typeof transformFunc == "function") {
              result = transformFunc(result);
            }
            // split
            result = result.split(new RegExp(splitChar || "\r"));
            resolve(result);
          }
        );
      } catch (e) {
        reject(e);
      }
    });
  }

  /*
    Cache
   */
  var cache = {
    treeData: {},
    keyMap: {}
  };

  /*
  -------------------------------------------------------------------------
  Sync API
  -------------------------------------------------------------------------
  */
  return {

    /**
     * Get the data of all libraries
     * @return {Map}[] An containing one map with the bookends library data
     */
    getLibraries: function() {
      return [{
          "id": 0,
          "name": "Bookends user library",
          "type": "user",
          "application": "bookends"
        }];
    },

    /**
     * Get the data of all collections
     * @param type {String} "user" | "group", ignored here
     * @param libraryId {Integer} Numeric id of library, ignored here
     * @return {Promise} resolves with an Array of maps containing the collection
     *    data
     */
    getCollections: function(type, libraryId) {
      console.debug('bookends::getCollections("' + [type, libraryId].join('","') + '")');
      return this.getBookendsGroups(true);
    },

    /**
     * Returns the collection data of the particular collection
     * @param  {String} type          Library type
     * @param  {Integer} libraryId     The numeric library id
     * @param  {String} collectionKey
     * @return {Promise}
     */
    getCollection: function(type, libraryId, collectionKey) {
      console.debug('bookends::getCollection("' + [type, libraryId].join('","') + '")');
      // we don't have a cache yet, create it
      var that = this;
      if (!cache.keyMap[collectionKey]) {
        return that.getBookendsGroups(true)
        .then(function() {
          return that.getCollection(type, libraryId, collectionKey);
        });
      }
      // retrieve from cache
      var groupName = cache.keyMap[collectionKey];
      var collection = cache.treeData[groupName];
      return Promise.resolve(collection);
    },

    /**
     * Returns the collection data of the particular collection.
     * This function is called synchronously; this requires that the
     * collection data has already been downloaded and cached.
     * @param  {String} type          Library type
     * @param  {Integer} libraryId     The numeric library id
     * @param  {String} collectionKey
     * @return {Map}
     */
    getCollectionSync: function(type, libraryId, collectionKey) {
      console.debug("bookends::getCollectionSync("+[type, libraryId, collectionKey].join(",")+")");
      if (!cache.keyMap[collectionKey]) {
        throw new Error("No cached data available");
      }
      var groupName = cache.keyMap[collectionKey];
      return cache.treeData[groupName];
    },

    /**
     * Returns the collectionKeys of the children of the given collection
     * This function is called synchronously; this requires that the
     * collection data has already been downloaded and cached.
     * @param  {String} type          [description]
     * @param  {Integer} libraryId     [description]
     * @param  {String} collectionKey [description]
     * @return {Array}  An array of collection keys
     */
    getCollectionChildKeysSync: function(type, libraryId, collectionKey) {
      console.debug("bookends::getCollectionChildKeysSync("+[type, libraryId, collectionKey].join(",")+")");
      if (!cache.keyMap[collectionKey]) {
        throw new Error("No cached data available");
      }
      var groupName = cache.keyMap[collectionKey];
      var treeData = cache.treeData;
      var keys = [];
      for (var key in treeData) {
        if ( treeData[key].parent == groupName ) {
          keys.push(treeData[key].key);
        }
      }
      return keys;
    },

    /**
     * Get the ids of all items in a collection
     * @param type {String} "user" | "group", ignored here
     * @param libraryId {Integer} Numeric id of library, ignored here
     * @param collectionKey {String} Key of the collection
     * @return {Promise} resolves with an Array of reference ids
     */
    getCollectionIDs: function(type, libraryId, collectionKey) {
      var that=this;
      console.debug("bookends::getCollectionIDs("+[type, libraryId, collectionKey].join(",")+")");
      // we don't have a cache yet, create it
      if (!cache.keyMap[collectionKey]) {
        return this.getBookendsGroups(true)
        .then(function() {
          return that.getCollectionIDs(null, null, collectionKey);
        });
      }
      // items are cached
      var group = cache.keyMap[collectionKey]; // transform hashed key into group name
      return this.getBookendsGroupIDs(group)
      .then(function(result) {
        var ids = result.filter(function(elem){
          return !isNaN(parseInt(elem));
        }).map(function(elem) {
          return parseInt(elem) ;
        });
        return ids;
      });
    },

    /**
     * Returns true if collections can be created, false if not
     * @return {Boolean}
     */
    canCreateCollection : function(){
      return false;
    },

    /**
     * Adds a collection. Not implemented in Bookends since collections cannot
     * be programmatically created yet.
     * @param {Map} data A Map containing the collection data. Must have at least
     *                   these keys: name {String}, parent : {String}
     * @return {Promise}  A Promise which resolves with the newly created key of the
     *                    collection
     */
    addCollection : function(data){
      throw new Error("Collections cannot be created in Bookends.");
    },

    /**
     * Get the data of all items in a collection
     * @param type {String} "user" | "group", ignored here
     * @param libraryId {Integer} Numeric id of library, ignored here
     * @param collectionKey {String} Key of the collection
     * @param fields [Array] Optional array of fields to use. If omitted, all
     *  fields are used.
     * @return {Promise} resolves with an Array of maps containing the collection
     *    data
     */
    getCollectionItems: function(type, libraryId, collectionKey, fields) {
      console.debug('bookends::getCollectionItems("' + [type, libraryId, collectionKey ].join('","') + '")');
      var that = this;
      return that.getCollectionIDs(null, null, collectionKey)
      .then( function(ids) {
        if( ids.length === 0 ) return [];
        return that.getReferenceData(ids)
        .then(function(result){
          result = result.map(function(item){
            var globalItem = _.omit( dictionary.translateToGlobal( item ), function(value){
              return !value;
            });
            if ( _.isArray(fields) && fields.length ){
              globalItem = _.pick( globalItem, fields );
            }
            // add type if missing
            if ( ! globalItem.itemType )
            {
              globalItem.itemType = dictionary.getGlobalContent( "itemType", item );
            }
            // add special fields if requested
            if( _.isArray(fields) ) {
              if ( fields.indexOf("creatorSummary") !== -1 )
              {
                globalItem.creatorSummary = item.authors || item.editors;
              }
              // add year if requested
              if( fields.indexOf("year") !== -1 )
              {
                globalItem.year = item.date;
              }
            }
            return globalItem;
          }).sort(function(a,b){
            var key =  a.creatorSummary ? "creatorSummary" : "authors";
            return ( a[key] < b[key] ) ? -1 : ( a[key] == b[key] ) ? 0 : 1;
          });
          return result;
        });
      });
    },

    /**
     * Given one or more ids and a field name, return the local content of the field(s)
     * of the reference(s) having this/these id(s).
     * @param  {Array} ids       An array with one or more ids
     * @param  {String} fieldName The name of the field
     * @return {Promise}  A promise resovling with an array containing
     * the field contents.
     */
    getFieldValues : function(ids, fieldName) {
      if( ! (ids instanceof Array && ids.length) ) {
        throw new Error("ids must be array with at least one element");
      }
      switch (fieldName) {
        case "date": fieldName = "thedate"; break;
        case "type": fieldName = "[type]"; break;
        case "pages": fieldName = "[pages]"; break;
        case undefined:
        case "":
        case null:
          throw new Error("Field name must be a string");
      }
      var cmd = ' "' + ids.join(',') + '"' + ' given string:' + '"' + fieldName + '"';
      return evalOSA(eventCode('RFLD') + cmd, String.fromCharCode(0));
    },

    /**
     * Returns the dates when the references with the given ids were last modified
     * @param  {Array} ids An array of numeric ids
     * @return {Promise} A Promise resolving with an array of Date objects
     */
    getModificationDates: function(ids) {
      if (!(ids instanceof Array)) throw new Error("ids must be an array.");
      var args = ' "' + ids.join(',') + '"';
      return evalOSA(eventCode('RMOD') + args, String.fromCharCode(0))
      .then(function(result) {
        return result.map(function(s) {
          return new Date(
            // Need Unix (1970) milliseconds (not 1904 seconds) for JS:
            // (drop 66 years of seconds, and convert to milliseconds)
            (parseInt(s, 10) - 2.0828448E+9) * 1000
          );
        });
      });
    },

    /*
    -------------------------------------------------------------------------
    Bookends-specific API
    -------------------------------------------------------------------------
    */

    /**
     * Get the names of all groups
     * @param withFullPath {Boolean} Whether to return the full path of the
     *    group name
     * @return {Promise} resolves with an Array of names
     */
    getBookendsGroups: function(withFullPath) {
      var args = withFullPath ? ' given «class PATH»: "true"' : "";
      return evalOSA(eventCode('RGPN') + args, "\r", function(result) {
          return result.substring(1, result.length - 2);
        })
        .then(function(result) {
          var map = {};
          cache.keyMap = {};
          for (var j = 0; j < result.length; j++) {
            var collectionName = result[j];
            // escape "/"
            collectionName = collectionName.replace(/\/\//g, "<<slash>>");
            var slugs = collectionName.split(/\//);
            //...

            for (var i = slugs.length - 1; i >= 0; i--) {
              var slug = slugs[i].replace(/<<slash\>\>/g, "/");
              var key = md5(slug);
              map[slug] = {
                key: key,
                name: slug,
                parentKey: i > 0 ? slugs[i - 1].replace(/<<slash\>\>/g, "/") : false
              };
              cache.keyMap[key] = slug;
            }
          }
          //console.dir(map);
          cache.treeData = map;
          return map;
        });
    },


    /**
     * Get the ids of references in a bookends group
     * @param group {String} name of the group
     * @return {Promise} resolves with an Array of reference ids as STRINGS!
     */
    getBookendsGroupIDs: function(group) {
      if (!group) throw new Error("Group must be valid string");
      var args = ' "' + group + '"';
      return evalOSA(eventCode('RUID') + args, "\r", function(result) {
        return result.substring(1, result.length - 2);
      });
    },

    /**
     * Formats references
     * @param  {Array} ids   An array of numeric ids
     * @param  {String} style The style. Must be one of the styles defined in bookendsAPI
     * @return {Array}  An array of strings which contain the formatted references
     */
    getFormattedRefs: function(ids, style) {
      if (!(ids instanceof Array)) throw new Error("ids must be an array.");
      // max 500 entries
      if (ids.length > 100) {
        ids = ids.slice(0, 99);
      }
      var args = ' "' + ids.join(',') + '" given «class RRTF»:"false", string:"' + (style || '') + '"';
      return evalOSA(eventCode('GUID') + args, "\n", function(result) {
        return result.replace(/\[\#\!\#\]/g, "\n").substring(2, result.length - 2);
      });

      // Retrieve in smaller chunks
      // var promises = [];
      //
      // while (ids.length) {
      //   var s = ids.splice(-50, 50);
      //   var args = ' "' + s.join(',') + '" given «class RRTF»:"false", string:"' + (style || '') + '"';
      //   promises.push(evalOSA(eventCode('GUID') + args, "\r\r\r", function(result) {
      //     return result.substring(1, result.length - 2);
      //   }));
      // }
      // return Promise.all(promises);
    },

    /**
     * Given an array of ids, return the normalized reference data
     * @param ids {Array}
     * @return {Promise} A Promise resolving with an array of maps with the reference data
     */
    getReferenceData: function(ids) {
      return this.getFormattedRefs(ids, "Export")
      .then(function(result) {
        var data = [], i = 1;
        result.forEach(function(taggedData) {
          var dict = {};
          var fieldName = "";
          taggedData.split(/\r/).map(function(line) {
            var i = line.indexOf(":");
            var maybeFieldName = line.substring(0, i);
            if ( dictionary.isLocalField(maybeFieldName) ) {
              fieldName = maybeFieldName;
              dict[fieldName] = line.substring(i + 2);
            } else if (fieldName && maybeFieldName === undefined) {
              if (line.length > 0 || fieldName == "abstract" || fieldName == "notes") {
                dict[fieldName] += "\n" + line;
              }
            }
          });
          if (fieldName) {
            data.push(dict);
          }
        });
        return data;
      });
    },

    // return «event ToySADDA» "/Users/username/Desktop/myPaper.pdf" given
    // «class RIST»:"TY - JOUR" & return & "T1 - The Title" & return &
    // "AU - Harrington Joseph" & return & "PY - 2015" & return &
    // "UR - http:// www.sonnysoftware.com" & return


    /**
     * Adds a reference to the bookends database
     * @param {Map} data Map of key-value pairs containing the normalized field data
     * @return {Promise} A Promise resolving with the numeric id of the newly created reference
     */
    add: function(data) {
      throw new Error("Not implemented");
      // var args = "";
      // if (data.attachments) {
      //   args += '"' + data.attachments + '"';
      // }
      // if (data.type) {
      //   args += ' given «class RIST»:"';
      // }
      // for (var key in data) {
      //   if (key == "attachments") continue;
      //
      // }
      // return evalOSA(eventCode('ADDA') + args, '\n');
    },

    // fieldWrite :: String -> String -> String -> ()
    // authors, title, editors, journal, volume, pages, thedate,
    // publisher, location, url, title2, abstract, notes, user1...user20
    set: function(strID, strFieldName, strValue) {
      var args = ' "' + strID + '" given «class FLDN»:"' + strFieldName + '", string:"' + strValue + '"';
      return evalOSA(eventCode('SFLD') + args);
    },


    // sqlMatchIDs :: String -> [String]
    // SELECT clause without the leading SELECT keyword
    sqlMatchIDs: function(strClause) {
      return evalOSA(eventCode('SQLS') + ' "' + strClause + '"');
    },
  };
};
