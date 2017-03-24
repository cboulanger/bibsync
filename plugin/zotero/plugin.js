// modules
var service   = require("./services");

// configuration
var config    = require("../../config.js");

// load custom console
var console = config.getConsole();

module.exports = function zotero(bibsync, done)
{

  var app = bibsync.getRouter();

  app.get('/zotero/libraries', service.libraries);

  // collections
  app.get('/zotero/:type/:id/collections/flat', service.collectionsFlat);
  app.get('/zotero/:type/:id/collections/tree', service.collectionsTree);

  app.get('/zotero/:type/:id/collections/:collection/ids', service.collectionIds );
  app.get('/zotero/:type/:id/collections/:collection/summary', service.collectionItemsSummary );

  app.get('/zotero/:type/:id/collections/:collection/items', service.collectionItems );

  app.delete('/zotero/:type/:id/collections/:collection/items', service.collectionItems );

  // items
  //app.get('/zotero/:type/:id/items/:ids', service.items );
  app.post('/zotero/:type/:id/items', service.createItem );
  app.put('/zotero/:type/:id/items', service.copyItem );
  app.patch('/zotero/:type/:id/items', service.updateItem );
  app.delete('/zotero/:type/:id/collections/:collectionKey/items', service.updateItem );
  //app.get('/zotero/:type/:id/item/:itemId', service.getItem );

  console.debug('Loaded Zotero plugin.');
  done(null,this);
};
