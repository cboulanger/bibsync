var service   = require("./services");

module.exports = function zotero(bibsync, done) {
  console.log('Zotero plugin');
  var app = bibsync.getRouter();

  app.get('/zotero/libraries', service.libraries);
  app.get('/zotero/:type/:id/collections/flat', service.collectionsFlat);
  app.get('/zotero/:type/:id/collections/tree', service.collectionsTree);
  app.get('/zotero/:type/:id/collection/:collection/ids', service.collectionIds );
  app.get('/zotero/:type/:id/collection/:collection/summary', service.collectionItemsSummary );

  done(null,this);
};
