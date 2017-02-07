var zoteroAPI    = require("../api/zotero");
var bookendsAPI  = require("../api/bookends");

module.exports =
{



  /**
   *
   */
  bookends2zotero : function(req, res) {
    bookendsAPI.getCollections(true)
      .then(function( result ){
        res.send( JSON.stringify(result) );
      })
      .catch(function(err){
        res.status(500).send(err);
      });
  },
};
