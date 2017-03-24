var service = require("./services");
var config  = require('../../config');

// load custom console
var console = config.getConsole();

module.exports = function bookends(bibsync, done) {

  var app = bibsync.getRouter();

  app.get('/bookends/libraries', service.libraries);
  app.get('/bookends/:type/:id/collections/flat', service.collectionsFlat);
  app.get('/bookends/:type/:id/collections/tree', service.collectionsTree);
  app.get('/bookends/:type/:id/collections/:collection/ids', service.collectionIds );
  app.get('/bookends/:type/:id/collections/:collection/summary', service.collectionItemsSummary );
  app.get('/bookends/:type/:id/collections/:collection/items', service.collectionItems );

  app.get('/bookends/:type/:id/items/:ids', service.items );

  //app.get('/bookends/format/:ids/:style', service.formatReferences );

  app.get('/bookends/moddates/:ids', service.moddates );
  app.get('/bookends/get/:ids/:field', service.get );

  console.debug('Loaded Bookends plugin.');

  done(null,this);
};
