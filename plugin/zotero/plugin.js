/**
 * Zotero plugin
 * @param  {Function} done Callback function to be called when plugin
 * is configured.
 * @return {void}
 */
module.exports = function zotero(bibsync, done)
{
  var sandbox   = bibsync;
  var console   = sandbox.getConsole();
  var router    = sandbox.getRouter();
  var services  = require("./services")(sandbox);

  /*
    zotero services
   */
  // libraries
  router.get('/zotero/libraries', services.libraries);

  // collections
  router.get('/zotero/:type/:id/collections/flat', services.collectionsFlat);
  router.get('/zotero/:type/:id/collections/tree', services.collectionsTree);
  router.get('/zotero/:type/:id/collections/:collection/ids', services.collectionIds );
  router.get('/zotero/:type/:id/collections/:collection/summary', services.collectionItemsSummary );
  router.get('/zotero/:type/:id/collections/:collection/items', services.collectionItems );
  router.delete('/zotero/:type/:id/collections/:collection/items', services.collectionItems );

  // items
  //router.get('/zotero/:type/:id/items/:ids', service.items );
  router.post('/zotero/:type/:id/items', services.createItem );
  router.put('/zotero/:type/:id/items', services.copyItem );
  router.patch('/zotero/:type/:id/items', services.updateItem );
  router.delete('/zotero/:type/:id/collections/:collectionKey/items', services.updateItem );
  //router.get('/zotero/:type/:id/item/:itemId', service.getItem );

  console.debug('Loaded Zotero plugin.');
  done(null,this);
};
