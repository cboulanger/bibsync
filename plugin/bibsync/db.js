// https://github.com/louischatriot/nedb

var Datastore = require('nedb');
var ds = new Datastore({ filename: '../../data/syncdata', autoload: true });
ds.ensureIndex({ fieldName: 'source' });
ds.ensureIndex({ fieldName: 'target' });

module.exports = {
  save : function(info, sourceItemId, targetItemId ){
    return new Promise(function(resolve,reject){
      ds.insert({
        source: [info.source.application,info.source.type,info.source.id,sourceItemId].join(":"),
        target: [info.target.application,info.target.type,info.target.id,targetItemId].join(":")
      }, function (err, newDoc) {
        if(err) reject(err);
        console.log("=== saved in database ===");
        console.dir(newDoc);
        resolve();
      });
    });
  }
};
