var _ = require("underscore");

/**
 * Bookends service methods
 * @param  {Object} sandbox An object exposing the application API
 * @return {Object} An object exposing the service methods
 */
module.exports = function(sandbox)
{
  var console = sandbox.getConsole();
  var config  = sandbox.getConfig();
  var api     = require("./api")(sandbox);
  var success = sandbox.success;
  var fail    = sandbox.fail;

  sandbox.addApi("bookends",api);

  /**
   * In-memory cache
   * @type {Object}
   */
  var cache = {};

  // service methods
  return {

    /**
     * Return the data of available libraries
     * /zotero/libraries
     * @param  {Object} req Express request Object
     * @param  {Object} res Express response Object
     * @return {void}
     */
    libraries : function(req, res) {
      api.getLibraries()
        .then(function( result ){
          res.json( result );
        })
        .catch(function(err){
          console.error(""+err);
          res.status(500).send(err);
        });
    },

    /**
     * Return the data of all collections in a flat structure
     * /bookends/:type/:id/collections/flat
     * @param  {Object} req Express request Object
     * @param  {Object} res Express response Object
     * @return {void}
     */
    collectionsFlat : function(req, res) {
      api.getCollections()
        .then(function( result ){
          res.json( result );
        })
        .catch(function(err){
          console.error(""+err);
          res.status(500).send(err);
        });
    },

    /**
     * Return the data of all collections in a tree structure
     * /bookends/:type/:id/collections/tree
     * @param  {Object} req Express request Object
     * @param  {Object} res Express response Object
     * @return {void}
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
          var parentKey  = result[key].parentKey;
          var parentNode = parentKey ? nodes[result[parentKey].index] : nodes[0];
          // hack to get rid of corrupted top folders without children
          if( parentNode === nodes[0] && childNode.children.length === 0 ) continue;
          // add child
          parentNode.children.push(childNode);
          // sort
          parentNode.children = parentNode.children.sort(function(a,b){
            var an = a.name.replace(/_/,"a");
            var bn = b.name.replace(/_/,"a");
            return ( an < bn ) ? -1 : ( an == bn ) ? 0 : 1;
          });
        }
        cache.tree = nodes;
        res.json( nodes );
      })
      .catch(function(err){
        console.error(""+err);
        res.status(500).send(err);
      });
    },


    /**
     * Returns the ids of the references in a collection
     * /bookends/collections/:collection/ids
     * @param  {Object} req Express request object
     * @param  {Object} res Express response object
     * @return {void}
     */
    collectionIds : function(req,res)
    {
      api.getCollectionIDs(null,null, req.params.collection)
        .then(function( result ){
          res.json( result );
        })
        .catch(function(err){
          console.error(""+err);
          res.status(500).send(err);
        });
    },

    /**
     * Returns the summary of the reference data in a collection (author,title,year)
     * /bookends/:type/:libId/collections/:collection/summary
     * @param  {Object} req Express request object
     * @param  {Object} res Express response object
     * @return {void}
     */
    collectionItemsSummary : function(req,res)
    {
      var collection = req.params.collection;
      api.getCollectionItems(null, null, collection, ['id','creatorSummary','title','year'])
        .then(function( result ){
          res.json( result );
        })
        .catch(function(err){
          console.error(""+err);
          res.status(500).send(""+err);
        });
    },

    /**
     * Returns the data of the references in a collection
     * /bookends/:type/:libId/collections/:collection/items
     * @param  {Object} req Express request object
     * @param  {Object} res Express response object
     * @return {void}
     */
    collectionItems : function(req,res)
    {
      var collection = req.params.collection;
      api.getCollectionItems(null, null, collection )
        .then(function( result ){
          res.json( result );
        })
        .catch(function(err){
          console.error(""+err);
          res.status(500).send(err);
        });
    },


  // ============================

    /**
     * Returns an array of references formatted in the given style
     * /format/:ids
     * @param  {Object} req Express request object
     * @param  {Object} res Express response object
     * @return {void}
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
          console.error(""+err);
          res.status(500).send(err);
        });
    },


    /**
     * Returns the data of the given reference as normalized data
     * /bookends/:type/:id/items/:ids
     * @param  {Object} req Express request object
     * @param  {Object} res Express response object
     * @return {void}
     */
    items : function(req,res)
    {
      var ids = req.params.ids.split(/,/);
      api.getReferenceData(ids)
        .then(function( result ){
            res.json( result );
        })
        .catch(function(err){
          console.error(""+err);
          res.status(500).send(err);
        });
    },

    /**
     * Returns the data of the given reference as CSL input data
     * /moddates/:ids
     * @param  {Object} req Express request object
     * @param  {Object} res Express response object
     * @return {void}
     */
    moddates : function(req,res)
    {
      api.getModificationDates(req.params.ids)
        .then(function( result ){
            res.json( result );
        })
        .catch(function(err){
          console.error(""+err);
          res.status(500).send(err);
        });
    },

    /**
     * Returns the data of the given reference as CSL input data
     * /get/:ids/:field
     *
     * @param  {Object} req Express request object
     * @param  {Object} res Express response object
     * @return {void}
     */
    get : function(req,res)
    {
      api.get(req.params.ids,req.params.field)
        .then(function( result ){
            res.json( result );
        })
        .catch(function(err){
          console.error(""+err);
          res.status(500).send(err);
        });
    }
  };
};
