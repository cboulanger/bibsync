/**
 * Bookends plugin
 * @param  {Function} done Callback function to be called when plugin
 * is configured.
 * @return {void}
 */
module.exports = function bookends(bibsync, done)
{
  var sandbox   = bibsync; 
  var console   = sandbox.getConsole();
  var router    = sandbox.getRouter();
  var services  = require("./services")(sandbox);

  /*
    zotero services
   */
  // libraries
  router.get('/bookends/libraries', services.libraries);
  // collections
  router.get('/bookends/:type/:id/collections/flat', services.collectionsFlat);
  router.get('/bookends/:type/:id/collections/tree', services.collectionsTree);
  router.get('/bookends/:type/:id/collections/:collection/ids', services.collectionIds );
  router.get('/bookends/:type/:id/collections/:collection/summary', services.collectionItemsSummary );
  router.get('/bookends/:type/:id/collections/:collection/items', services.collectionItems );
  // items
  router.get('/bookends/:type/:id/items/:ids', services.items );
  //app.get('/bookends/format/:ids/:style', service.formatReferences );
  router.get('/bookends/moddates/:ids', services.moddates );
  router.get('/bookends/get/:ids/:field', services.get );

  console.debug('Loaded Bookends plugin.');

  done(null,this);
};
