// https://github.com/louischatriot/nedb

var config = require('../../config');

// load custom console
var console = config.getConsole();

/**
 * returns the datastore API
 * @param  {Object} ds The datastore object to use
 * @return {Object} the API Object
 */
module.exports = function(ds) {

  // API
  return {

    /**
     * Checks if there is already a link between the source item and the target
     * library (i.e., the item has already been copied) and returns the key of
     * the linked item in the database. Returns false if no such link exists.
     * The URIs parameter uniquely identify the source and the target library.
     * These URIs can be real URLs if the items are accessible via the web, or
     * pseudo-urls (for example, http://purl.org/application/) The key parameters
     * are strings that uniquely identify the item in the library databases.
     * @param {String} sourceLibUri Unique identifier of source library
     * @param {String} sourceKey Unique identifier of the item in the source library
     * @param {String} targetLibUri Unique identifier of target library
     * @return {Promise} A Promise that resolves with the key of the copied
     * item in the target library if it exists, otherwise with boolean false.
     */
    getTargetKey: function(sourceLibUri, sourceKey, targetLibUri) {

      return new Promise(function(resolve, reject) {
        ds.find({
          sourceLibUri: sourceLibUri,
          sourceKey: sourceKey,
          targetLibUri: targetLibUri
        }, function(err, docs) {
          if (err) return reject(err);
          // source uri is not in the database, insert
          if (docs.length === 0) {
            console.debug("No target key exists for " + [sourceLibUri, sourceKey, targetLibUri].join(", "));
            return resolve(false);
          } else {
            var targetItemKey = docs[0].targetKey;
            console.debug("Target key for " + [sourceLibUri, sourceKey, targetLibUri].join(", ") + ": " + targetItemKey);
            resolve(targetItemKey);
          }
        });
      });
    },

    /**
     * Saves a link between source and target item
     * @param {String} sourceLibUri Unique identifier of source library
     * @param {String} sourceKey Unique identifier of the item in the source library
     * @param {String} targetLibUri Unique identifier of target library
     * @param {String} targetKey Unique identifier of the item in the target library
     * @param {String} targetCollectionKey Unique
     * identifier of the collection in the target library
     * @return {Boolean} Returns true if successful, false if link already exists.
     */
    saveLink: function(sourceLibUri, sourceKey, targetLibUri, targetKey) {
      return new Promise(function(resolve, reject) {
        ds.insert({
          sourceLibUri: sourceLibUri,
          sourceKey: sourceKey,
          targetLibUri: targetLibUri,
          targetKey: targetKey
        }, function(err, newDoc) {
          if (err) return reject(err);
          console.debug("Savedlink for " + [sourceLibUri, sourceKey, targetLibUri, targetKey].join(", "));
          resolve(true);
        });
      });
    }
  };
};
