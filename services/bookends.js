var bookendsAPI  = require("../api/bookends");

var cache = {};

module.exports =
{

  /**
   * Return the data of available libraries
   * /zotero/libraries
   */
  libraries : function(req, res) {
    bookendsAPI.getLibraries()
      .then(function( result ){
        res.json( result );
      })
      .catch(function(err){
        res.status(500).send(err);
      });
  },

  /**
   * Return the data of all collections in a flat structure
   * /bookends/:type/:id/collections/flat
   */
  collectionsFlat : function(req, res) {
    bookendsAPI.getCollections()
      .then(function( result ){
        res.json( result );
      })
      .catch(function(err){
        res.status(500).send(err);
      });
  },

  /**
   * Return the data of all collections in a tree structure
   * /bookends/:type/:id/collections/tree
   */
  collectionsTree : function(req, res) {

    bookendsAPI.getCollections()
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

          // hack to get rid of corrupted top folders without children
          if( parentNode === nodes[0] && childNode.children.length == 0 ) continue;

          parentNode.children.push(childNode);
        }
      }catch(e){console.warn(e);}
        cache.tree = nodes;
        res.json( nodes );
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
    bookendsAPI.getCollectionIDs(null,null, req.params.collection)
      .then(function( result ){
        res.json( result );
      })
      .catch(function(err){
        res.status(500).send(err);
      });
  },

  /**
   * Returns the data of the references in a collection
   * /bookends/:type/:libId/collection/:collection/ids
   */
  collectionItems : function(req,res)
  {
    var collection = req.params.collection;
    bookendsAPI.getCollectionItems(null, null, collection)
      .then(function( result ){
        result = result.map(function(item) {
          return {
            authors: item.authors || item.editors,
            title: item.title,
            date: item.date
          };
        });
        result.sort(function(a,b){
          return ( a.authors < b.authors ) ? -1 : ( a.authors == b.authors ) ? 0 : 1 ;
        });
        res.json( result );
      })
      .catch(function(err){
        res.status(500).send(err);
      });
  },

  /**
   * /format/:ids
   * Returns an array of references formatted in the given style
   */
  formatReferences : function(req,res)
  {
    var ids = req.params.ids.split(/,/);
    var style = req.params.style;
    bookendsAPI.getFormattedRefs( ids, style )
      .then(function( result ){
          res.json( result );
      })
      .catch(function(err){
        res.status(500).send(err);
      });
  },


  /**
   * /reference/:ids
   * Returns the data of the given reference as normalized data
   */
  reference : function(req,res)
  {
    var ids = req.params.ids.split(/,/);
    bookendsAPI.getReferenceData(ids)
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
