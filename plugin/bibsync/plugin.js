var service   = require("./services");
var config    = require("../../config");

module.exports = function bibsync(done) {
  console.log('BibSync appplication');

  // express with socket.io
  var express = require('express');
  var app     = express();
  var server  = require('http').Server(app);
  var io      = require('socket.io')(server);

  // static html files
  app.use(express.static('html/bibSync'));
  app.use(express.static('.')); // only for development!

  // sync API
  app.get('/libraries', service.libraries);
  app.get(
    '/sync/:sourceApplication/:sourceType/:sourceId/:sourceCollectionKey/'+
    'to/:targetApplication/:targetType/:targetId/:targetCollectionKey/:action',
    service.startSync
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
    console.log('Server listening on http://localhost:3000 ...');
    done(null, bibsync);
  });
};
