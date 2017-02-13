// Uses code by ComplexPoint on https://www.sonnysoftware.com/phpBB3/viewtopic.php?f=2&t=4017

var osascript = require('node-osascript');
var Promise   = require('promise');
var md5       = require('md5');
var _         = require("underscore");

// setup mappings:
var global_map    = require('../bibsync/map');
var global_types  = global_map.types;
var global_fields = global_map.fields;
var local_map     = require('./map');
var local_types   = local_map.types.toGlobal;
var local_fields  = local_map.fields.toGlobal; // TODO


/**
 * Given an event code, return the AppleScript command
 * @param  {String} eventCode
 * @return {String}
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
 */
function evalOSA(OSACommand, splitChar, transformFunc) {
  return new Promise(function(resolve, reject) {
    console.log(OSACommand);
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

module.exports = {

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
   * TODO
   */
  getLocalField: function(globalField, data) {
    return local_map.translateName(local_map.fields.toLocal, globalField, data);
  },

  /**
   * Given a local field name, return the global field name
   * @param  {String} localField The name of the local field
   * @param  {Map} data        The reference data
   * @return {String}
   * TODO
   */
  getGlobalField: function(localField, data) {
    return local_map.translateName(local_map.fields.toGlobal, localField, data);
  },

  /**
   * Given a local field content, return the global field content
   * @param  {String} localField The name of the global field
   * @param  {Map} data        The reference data
   * @return {String|Map} If String, the content of the given local field. If
   *                      Map, the keys and values of several local fields
   * TODO
   */
  getGlobalContent: function(localField, data) {
    //console.log("localField:"+localField);
    //console.dir (data );
    return local_map.translateContent(local_map.fields.toGlobal, localField, data);
  },

  /**
   * Given a global field content, return the local field content
   * @param  {String} localField The name of the local field
   * @param  {Map} data        The reference data
   * @return {String|Map} If String, the content of the given local field. If
   *                      Map, the keys and values of several local fields‚
   * TODO
   */
  getLocalContent: function(globalField, data) {
    return local_map.translateContent(local_map.fields.toLocal, globalField, data);
  },


  /**
   * Return the field name that is used to store a unique id that is used for synchronization
   * @return {String}
   */
  getSyncIdField : function(){
    return "user20";
  },


  /**
   * Get the data of all libraries
   * @return {Map}[] An containing one map with the bookends library data
   */
  getLibraries: function() {
    return new Promise(function(resolve, reject) {
      resolve([{
        "id": 0,
        "name": "Bookends user library",
        "type": "user",
        "application": "bookends"
      }]);
    });
  },

  /**
   * Get the data of all collections
   * @param type {String} "user" | "group", ignored here
   * @param libraryId {Integer} Numeric id of library, ignored here
   * @return {Promise} resolves with an Array of maps containing the collection
   *    data
   */
  getCollections: function(type, libraryId) {
    console.log('bookends::getCollections("' + [type, libraryId].join('","') + '")');
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
    console.log('bookends::getCollection("' + [type, libraryId].join('","') + '")');
    // we don't have a cache yet, create it
    var that = this;
    if (!cache.keyMap[collectionKey]) {
      return new Promise(function(resolve, reject) {
        that.getBookendsGroups(true)
          .then(function() {
            that.getCollection(type, libraryId, collectionKey)
              .then(resolve);
          }).catch(function(err) {
            reject(err);
          });
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
    console.log("bookends::getCollectionSync("+[type, libraryId, collectionKey].join(",")+")");
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
    console.log("bookends::getCollectionChildKeysSync("+[type, libraryId, collectionKey].join(",")+")");
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
    console.log("bookends::getCollectionIDs("+[type, libraryId, collectionKey].join(",")+")");
    var that = this;

    // we don't have a cache yet, create it
    if (!cache.keyMap[collectionKey]) {
      return new Promise(function(resolve, reject) {
        that.getBookendsGroups(true)
          .then(function() {
            that.getCollectionIDs(null, null, collectionKey)
              .then(resolve);
          }).catch(function(err) {
            reject(err);
          });
      });
    }

    var group = cache.keyMap[collectionKey]; // transform hashed key into group name
    //console.log(collectionKey, group);
    return new Promise(function(resolve, reject) {
      that.getBookendsGroupIDs(group)
        .then(function(result) {
          var ids = result.filter(function(elem){
            return !isNaN(parseInt(elem));
          }).map(function(elem) {
            return parseInt(elem) ;
          })
          resolve(ids);
        })
        .catch(function(err) {
          reject(err);
        });
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
    console.log('bookends::getCollectionItems("' + [type, libraryId, collectionKey ].join('","') + '")');
    var that = this;
    return new Promise(function(resolve, reject) {
      that.getCollectionIDs(null, null, collectionKey)
        .then( function(ids) {
          if( ids.length === 0 ) return resolve([]);

          that.getReferenceData(ids)
            .then(function(result){
              result = result.map(function(item){
                //console.log("=======================================================");
                //console.dir( item );
                //console.log("=======================================================");

                var globalItem = {};

                for ( var key in item )
                {
                  if ( fields instanceof Array && fields.indexOf(key) ===-1 ) continue;

                  var globalField = that.getGlobalField(key,  item);
                  if ( globalField ){
                    var content = that.getGlobalContent(key, item);
                    if( content) globalItem[globalField] = content;
                  }
                }

                globalItem.creatorSummary = item.authors || item.editors;

                // add a unique id for synchronization
                globalItem.syncId = "bookends#" + item.id;

                return globalItem;

              }).sort(function(a,b){
                return ( a.creatorSummary < b.creatorSummary ) ? -1 : ( a.creatorSummary == b.creatorSummary ) ? 0 : 1 ;
              });
              resolve(result);
            }).catch(reject);
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
    var args = ' "' + ids.join(',') + '"';
    return new Promise(function(resolve, reject) {
      evalOSA(eventCode('RMOD') + args, String.fromCharCode(0))
        .then(function(result) {
          resolve(result.map(function(s) {
            return new Date(
              // Need Unix (1970) milliseconds (not 1904 seconds) for JS:
              // (drop 66 years of seconds, and convert to milliseconds)
              (parseInt(s, 10) - 2.0828448E+9) * 1000
            );
          }));
        })
        .catch(reject);
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

    return new Promise(function(resolve, reject) {
      var args = withFullPath ? ' given «class PATH»: "true"' : "";
      evalOSA(eventCode('RGPN') + args, "\r", function(result) {
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
                parent: i > 0 ? slugs[i - 1].replace(/<<slash\>\>/g, "/") : false
              };
              cache.keyMap[key] = slug;
            }
          }
          //console.dir(map);
          cache.treeData = map;
          resolve(map);
        })
        .catch(function(err) {
          reject(error);
        });
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
    var that = this;
    return new Promise(function(resolve, reject) {
      that.getFormattedRefs(ids, "Export")
        .then(function(result) {
          var data = [],
            i = 1;
          result.forEach(function(taggedData) {
            var dict = {};
            var fieldName = "";
            taggedData.split(/\r/).map(function(line) {
              var i = line.indexOf(":");
              var maybeFieldName = line.substring(0, i);
              if ( local_map.fields.toGlobal[maybeFieldName] !== undefined) {
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
          resolve(data);
        })
        .catch(reject);
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
    var args = "";
    if (data.attachments) {
      args += '"' + data.attachments + '"';
    }
    if (data.type) {
      args += ' given «class RIST»:"';
    }
    for (var key in data) {
      if (key == "attachments") continue;

    }


    return evalOSA(eventCode('ADDA') + args, '\n');
  },


  // fieldContents [String] -> maybe String -> String
  // authors, title, editors, journal, volume, pages, thedate,
  // publisher, location, url, title2, abstract, notes, user1...user20
  get: function(ids, maybeFieldName) {
    if (maybeFieldName && fields[maybeFieldName]) {
      maybeFieldName = fields[maybeFieldName].bookendsDbCol;
    }
    var idsStr = ' "' + (ids instanceof Array ? ids : [ids]).join(',');
    var fieldNameStr = '"' + (maybeFieldName ? (' given string:' + '"' + maybeFieldName + '"') : '');
    return evalOSA(eventCode('RFLD') + idsStr + fieldNameStr, String.fromCharCode(0), true, function(value) {
      return (fieldNameStr == "[type]") ? local_types[value] : value;
    });
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
