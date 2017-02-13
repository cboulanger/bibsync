var api  = require("./api");

var cache = {};

module.exports =
{

  /**
   * Return the data of available libraries
   * /zotero/libraries
   */
  libraries : function(req, res) {
    api.getLibraries()
      .then(function( result ){
        res.json( result );
      })
      .catch(function(err){
        console.warn(err);
        res.status(500).send(err);
      });
  },

  /**
   * Return the data of all collections in a flat structure
   * /bookends/:type/:id/collections/flat
   */
  collectionsFlat : function(req, res) {
    api.getCollections()
      .then(function( result ){
        res.json( result );
      })
      .catch(function(err){
        console.warn(err);
        res.status(500).send(err);
      });
  },

  /**
   * Return the data of all collections in a tree structure
   * /bookends/:type/:id/collections/tree
   */
  collectionsTree : function(req, res) {

    api.getCollections()
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
        for ( key in result )
        {
          var childNode  = nodes[result[key].index];
          var parentKey  = result[key].parent;
          var parentNode = parentKey ? nodes[result[parentKey].index] : nodes[0];

          // hack to get rid of corrupted top folders without children
          if( parentNode === nodes[0] && childNode.children.length === 0 ) continue;

          parentNode.children.push(childNode);
        }

        cache.tree = nodes;
        res.json( nodes );
      })
      .catch(function(err){
        console.warn(err);
        res.status(500).send(err);
      });
  },


  /**
   * Returns the ids of the references in a collection
   * /bookends/collection/:collection/ids
   */
  collectionIds : function(req,res)
  {
    api.getCollectionIDs(null,null, req.params.collection)
      .then(function( result ){
        res.json( result );
      })
      .catch(function(err){
        console.warn(err);
        res.status(500).send(err);
      });
  },

  /**
   * Returns the summary of the reference data in a collection (author,title,year)
   * /bookends/:type/:libId/collection/:collection/summary
   */
  collectionItemsSummary : function(req,res)
  {
    var collection = req.params.collection;
    api.getCollectionItems(null, null, collection, ['id','creatorSummary','title','date'])
      .then(function( result ){
        res.json( result );
      })
      .catch(function(err){
        console.warn(err);
        res.status(500).send(err);
      });
  },

  /**
   * Returns the data of the references in a collection
   * /bookends/:type/:libId/collection/:collection/items
   */
  collectionItems : function(req,res)
  {
    var collection = req.params.collection;
    api.getCollectionItems(null, null, collection )
      .then(function( result ){
        res.json( result );
      })
      .catch(function(err){
        console.warn(err);
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
    api.getFormattedRefs( ids, style )
      .then(function( result ){
          res.json( result );
      })
      .catch(function(err){
        console.warn(err);
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
    api.getReferenceData(ids)
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
    api.getModificationDates(req.params.ids)
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
    api.get(req.params.ids,req.params.field)
      .then(function( result ){
          res.json( result );
      })
      .catch(function(err){
        res.status(500).send(err);
      });
  }
};
