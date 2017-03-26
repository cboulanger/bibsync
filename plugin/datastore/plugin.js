var Datastore   = require('nedb');

/**
 * Datastore plugin
 * Uses npm dedb module (https://github.com/louischatriot/nedb)
 * @param  {Function} done Callback function to be called when plugin
 * is configured.
 * @return {void}
 */
module.exports = function datastore(done)
{
  /**
   * The nedb datastore object
   * @type {Object}
   */
  var ds = null;

  /**
   * The console object
   * @type {Object}
   */
  var myconsole = null;

  // API
  var api = {
    /**
     * Initializes the datastore
     * @param  {Object} config        The config object
     * @param  {Object} customconsole A custom console object, with a debug() method
     * @return {void}
     */
    init : function(config, customconsole){
      myconsole = customconsole;
      ds = new Datastore({ filename: config.datastore.filename, autoload: true });
      ds.ensureIndex({ fieldName: 'sourceLibUri' });
      ds.ensureIndex({ fieldName: 'sourceKey' });
      ds.ensureIndex({ fieldName: 'targetLibUri' });
      ds.ensureIndex({ fieldName: 'targetKey' });
      myconsole.debug("Initialized datastore.");
    },

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
            myconsole.debug("No target key exists for " + [sourceLibUri, sourceKey, targetLibUri].join(", "));
            resolve(false);
          } else {
            var targetItemKey = docs[0].targetKey;
            myconsole.debug("Target key for " + [sourceLibUri, sourceKey, targetLibUri].join(", ") + ": " + targetItemKey);
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
          myconsole.debug("Saved link for " + [sourceLibUri, sourceKey, targetLibUri, targetKey].join(", "));
          resolve(true);
        });
      });
    },

    /**
     * Removes a link between source and target item
     * @param {String} sourceLibUri Unique identifier of source library
     * @param {String} sourceKey Unique identifier of the item in the source library
     * @param {String} targetLibUri Unique identifier of target library
     * @param {String} targetKey Unique identifier of the item in the target library
     * @param {String} targetCollectionKey Unique
     * identifier of the collection in the target library
     * @return {Boolean} Returns true if successful.
     */
    removeLink: function(sourceLibUri, sourceKey, targetLibUri, targetKey) {
      return new Promise(function(resolve, reject) {
        ds.remove({
          sourceLibUri: sourceLibUri,
          sourceKey: sourceKey,
          targetLibUri: targetLibUri,
          targetKey: targetKey
        }, {}, function(err, num) {
          if (err) return reject(err);
          myconsole.debug("Removed link for " + [sourceLibUri, sourceKey, targetLibUri, targetKey].join(", "));
          resolve(true);
        });
      });
    }
  };

  done(null,api);
};
