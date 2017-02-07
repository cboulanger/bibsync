var zoteroAPI  = require("../api/zotero");

module.exports =
{
  /**
   * Return the data of available libraries
   */
  libraries : function(req, res) {
    zoteroAPI.getLibraries()
      .then(function( result ){
        res.json( result );
      })
      .catch(function(err){
        res.status(500).send(err);
      });
  },


  /**
   * Return the data of all collections in a flat structure
   * zotero/:type/:id/collections/flat
   */
  collectionsFlat : function(req, res) {
    var type  = req.params.type;
    var libId = req.params.id;
    zoteroAPI.getCollections(type, libId)
      .then(function( result ){
        res.json( result );
      })
      .catch(function(err){
        res.status(500).send(err);
      });
  },

  /**
   * Return the data of all collections in a tree structure
   * /zotero/:type/:id/collections/tree
   */
  collectionsTree : function(req, res) {
    var type  = req.params.type;
    var libId = req.params.id;
    zoteroAPI.getCollections(type, libId)
      .then(function( result ){

        var nodes = [{children:[]}];

        // first pass: create all nodes
        for ( var key in result )
        {
          nodes.push({
            name : result[key].name,
            key  : result[key].key,
            children : []
          });
          result[key].index = nodes.length-1;
        }
        // second pass: attach children
        try{
        for ( key in result )
        {
          var childNode  = nodes[result[key].index];
          var parentKey  = result[key].parent;
          var parentNode = parentKey ? nodes[result[parentKey].index] : nodes[0];
          parentNode.children.push(childNode);
        }
      }catch(e){console.warn(e);}
        res.json( nodes );
      })
      .catch(function(err){
        res.status(500).send(err);
      });
  },

  /**
   * Returns the ids of the references in a collection
   * /zotero/:type/:id/collection/:collection/ids
   */
  collectionIds : function(req,res)
  {
    res.status(500).send("Not implemented");
    // var type = req.params.type;
    // var id   = req.params.id;
    // var collection = req.params.collection;
    // zoteroAPI.getCollectionIds()
    //   .then(function( result ){
    //     result = result.map(function(value){ return parseInt(value); });
    //     res.json( result );
    //   })
    //   .catch(function(err){
    //     res.status(500).send(err);
    //   });
  },


  /**
   * Returns the data of the references in a collection
   * /zotero/:type/:libId/collection/:collection/ids
   */
  collectionItems : function(req,res)
  {
    var type = req.params.type;
    var id   = req.params.id;
    var collection = req.params.collection;
    zoteroAPI.getCollectionItems(type, id, collection)
      .then(function( result ){
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
    zoteroAPI.getFormattedRefs(req.params.ids,req.params.style)
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
    zoteroAPI.getReferenceData(req.params.ids)
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
    zoteroAPI.getModificationDates(req.params.ids)
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
    zoteroAPI.get(req.params.ids,req.params.field)
      .then(function( result ){
          res.json( result );
      })
      .catch(function(err){
        res.status(500).send(err);
      });
  }
};
