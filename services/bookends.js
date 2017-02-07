var bookendsAPI  = require("../api/bookends");

module.exports =
{

  /**
   * Return the names of all groups/collections
   * /bookends/collections
   */
  collections : function(req, res) {
    bookendsAPI.getCollections(true)
      .then(function( result ){
        res.json( result );
      })
      .catch(function(err){
        res.status(500).send(err);
      });
  },

  /**
   * Returns the ids of the references in a collection
   * /bookends/collection/:collection/ids
   */
  collectionIds : function(req,res)
  {
    bookendsAPI.getCollectionIDs(req.params.group)
      .then(function( result ){
        result = result.map(function(value){ return parseInt(value); });
        res.json( result );
      })
      .catch(function(err){
        res.status(500).send(err);
      });
  },

  /**
   * /format/:ids
   * Returns the ids of the references in this group
   */
  formatReferences : function(req,res)
  {
    bookendsAPI.getFormattedRefs(req.params.ids,req.params.style)
      .then(function( result ){
          res.json( result );
      })
      .catch(function(err){
        res.status(500).send(err);
      });
  },


  /**
   * /reference/:ids
   * Returns the data of the given reference as CSL input data
   */
  reference : function(req,res)
  {
    bookendsAPI.getReferenceData(req.params.ids)
      .then(function( result ){
          res.json( result );
      })
      .catch(function(err){
        res.status(500).send(err);
      });
  },

  /**
   * /moddates/:ids
   * Returns the data of the given reference as CSL input data
   */
  moddates : function(req,res)
  {
    bookendsAPI.getModificationDates(req.params.ids)
      .then(function( result ){
          res.json( result );
      })
      .catch(function(err){
        res.status(500).send(err);
      });
  },

  /**
   * /get/:ids/:field
   * Returns the data of the given reference as CSL input data
   */
  get : function(req,res)
  {
    bookendsAPI.get(req.params.ids,req.params.field)
      .then(function( result ){
          res.json( result );
      })
      .catch(function(err){
        res.status(500).send(err);
      });
  }
};
