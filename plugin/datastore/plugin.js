// https://github.com/louischatriot/nedb

var Datastore   = require('nedb');
var config      = require('../../config');

// load custom console
var console = config.getConsole();

module.exports = function datastore(done) {

  var ds = new Datastore({ filename: config.datastore.filename, autoload: true });
  ds.ensureIndex({ fieldName: 'sourceLibUri' });
  ds.ensureIndex({ fieldName: 'sourceKey' });
  ds.ensureIndex({ fieldName: 'targetLibUri' });
  ds.ensureIndex({ fieldName: 'targetKey' });

  var api = require('./api')(ds);
  config.datastore.instance = api; // TODO

  console.debug("Loaded nedb datastore.");
  done(null,api);

};
