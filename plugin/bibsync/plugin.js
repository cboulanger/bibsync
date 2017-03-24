var service   = require("./services");
var config    = require("../../config");

// load custom console
var console = config.getConsole();

module.exports = function bibsync(done) {

  console.debug('Loaded BibSync appplication.');

  // express with socket.io
  var express    = require('express');
  var app        = express();
  var server     = require('http').Server(app);
  var io         = require('socket.io')(server);
  var bodyParser = require("body-parser");

  // static html files
  app.use(express.static('html/bibSync'));
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json());

  app.use(express.static('.')); // only for development!

  // sync API
  app.get('/libraries', service.libraries);
  app.get(
    '/sync/:sourceApplication/:sourceType/:sourceId/:sourceCollectionKey/'+
    'to/:targetApplication/:targetType/:targetId/:targetCollectionKey/:action',
    service.startSync
  );

  app.get(
    '/copy/:sourceApplication/:sourceType/:sourceId/:sourceCollectionKey/'+
    'to/:targetApplication/:targetType/:targetId/:targetCollectionKey/',
    service.copyFolder
  );

  bibsync.getRouter = function()
  {
    return app;
  };

  bibsync.getSocket = function()
  {
    return io;
  };

  // start server
  server.listen(3000, function () {
    console.info('Server listening on http://localhost:3000 ...');
    done(null, bibsync);
  });
};
