var express         = require('express');
var bookendsService = require("./services/bookends");
var zoteroService   = require("./services/zotero");
var syncService     = require("./services/sync");
var config          = require("./config");

var app = express();

// static html files
app.use(express.static('html/bibSync'));
app.use(express.static('.')); // only for development!

// sync API
app.get('/sync/libraries', syncService.libraries);

// bookends services
app.get('/bookends/libraries', bookendsService.libraries);
app.get('/bookends/:type/:id/collections/flat', bookendsService.collectionsFlat);
app.get('/bookends/:type/:id/collections/tree', bookendsService.collectionsTree);
app.get('/bookends/:type/:id/collection/:collection/ids', bookendsService.collectionIds );
app.get('/bookends/:type/:id/collection/:collection/items', bookendsService.collectionItems );

app.get('/bookends/format/:ids/:style', bookendsService.formatReferences );
app.get('/bookends/reference/:ids', bookendsService.reference );
app.get('/bookends/moddates/:ids', bookendsService.moddates );
app.get('/bookends/get/:ids/:field', bookendsService.get );

// zotero
app.get('/zotero/libraries', zoteroService.libraries);
app.get('/zotero/:type/:id/collections/flat', zoteroService.collectionsFlat);
app.get('/zotero/:type/:id/collections/tree', zoteroService.collectionsTree);
//app.get('/zotero/:type/:id/collection/:collection/ids', zoteroService.collectionIds );
app.get('/zotero/:type/:id/collection/:collection/items', zoteroService.collectionItems );




// start server
app.listen(3000, function () {
  console.log('Server listening on http://localhost:3000 ...');
});
