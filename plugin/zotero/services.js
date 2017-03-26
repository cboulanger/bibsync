/**
 * Zotero service methods
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

  sandbox.addApi("zotero",api);

  return {
    /**
     * Return the data of available libraries
     * /zotero/libraries
     * @param  {Object} req Express request object
     * @param  {Object} res Express response object
     * @return {void}
     */
    libraries : function(req, res) {
      api.getLibraries()
      .then(success(res))
      .catch(fail(res));
    },


    /**
     * Return the data of all collections in a flat structure
     * /zotero/:type/:id/collections/flat
     * @param  {Object} req Express request object
     * @param  {Object} res Express response object
     * @return {void}
     */
    collectionsFlat : function(req, res) {
      var type  = req.params.type;
      var libId = req.params.id;
      api.getCollections(type, libId)
      .then(success(res))
      .catch(fail(res));
    },

    /**
     * Return the data of all collections in a tree structure
     * /zotero/:type/:id/collections/tree
     * @param  {Object} req Express request object
     * @param  {Object} res Express response object
     * @return {void}
     */
    collectionsTree : function(req, res) {
      var type  = req.params.type;
      var libId = req.params.id;
      api.getCollections(type, libId)
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
            parentNode.children.push(childNode);
            // sort
            parentNode.children = parentNode.children.sort(function(a,b){
              var an = a.name.replace(/_/g,"!");
              var bn = b.name.replace(/_/g,"!");
              return ( an < bn ) ? -1 : ( an == bn ) ? 0 : 1;
            });
          }
          res.json( nodes );
        })
        .catch(fail(res));
    },

    /**
     * Returns the ids of the references in a collection
     * /zotero/:type/:id/collection/:collection/ids
     * @param  {Object} req Express request object
     * @param  {Object} res Express response object
     * @return {void}
     */
    collectionIds : function(req,res)
    {
      var type = req.params.type;
      var id   = req.params.id;
      var collection = req.params.collection;
      api.getCollectionIds(type,id,collection)
      .then(success(res))
      .catch(fail(res));
    },


    /**
     * Returns a summary of the data of the references in a collection (author, title, year)
     * /zotero/:type/:libId/collection/:collection/summary
     * @param  {Object} req Express request object
     * @param  {Object} res Express response object
     * @return {void}
     */
    collectionItemsSummary : function(req,res)
    {
      var type = req.params.type;
      var id   = req.params.id;
      var collection = req.params.collection;
      api.getCollectionItems(type, id, collection, ['id','creatorSummary','title','year'])
      .then(success(res))
      .catch(fail(res));
    },

    /**
     * Returns the reference data in a collection
     * /zotero/:type/:libId/collection/:collection/items
     * @param  {Object} req Express request object
     * @param  {Object} res Express response object
     * @return {void}
     */
    collectionItems : function(req,res)
    {
      var type = req.params.type;
      var id   = req.params.id;
      var collection = req.params.collection;
      api.getCollectionItems(type, id, collection)
      .then(success(res))
      .catch(fail(res));
    },

    /**
     * Returns the data of the given reference as CSL input data
     * /zotero/:type/:id/items/:ids
     * @param  {Object} req Express request object
     * @param  {Object} res Express response object
     * @return {Unknown} An arbitrary json value
     */
    items : function(req,res)
    {
      var type = req.params.type;
      var id   = req.params.id;
      var ids = req.params.ids.split(/,/);
      api.getReferenceData(ids)
      .then(success(res))
      .catch(fail(res));
    },

    /**
     * Creates a new item in the library from client data
     * POST /zotero/:type/:id/items
     * @param  {Object} req Express request object
     * @param  {Object} res Express response object
     * @return {Unknown} An arbitrary json value
     */
    createItem : function(req,res)
    {
      api.createItem( req.params.type,req.params.id, req.body )
      .then(success(res))
      .catch(fail(res));
    },


    /**
     * Creates a new item in the library as a copy of an existing item on
     * the server
     * PUT /zotero/:type/:id/items
     * @param  {Object} req Express request object
     * @param  {Object} res Express response object
     * @return {Unknown} An arbitrary json value
     */
    copyItem : function(req,res)
    {
      api.copyItem( req.params.type,req.params.id, req.body )
      .then(success(res))
      .catch(fail(res));
    },

    /**
     * Returns the ids of the references in this group
     * PUT /zotero/:type/:id/items/:itemId
     * @param  {Object} req Express request object
     * @param  {Object} res Express response object
     * @return {void}
     */
    updateItem : function(req,res)
    {
      api.updateItem( req.params.type,req.params.id, req.body.data )
      .then(success(res))
      .catch(fail(res));
    },


    /**
     * Removes an item from a collection (doesn't delete it)
     * PUT /zotero/:type/:id/items/:itemId
     * @param  {Object} req Express request object
     * @param  {Object} res Express response object
     * @return {void}
     */
    removeCollectionItem : function(req,res)
    {
      api.removeCollectionItem( req.params.type,req.params.id, req.body.data )
      .then(success(res))
      .catch(fail(res));
    },

  ///////////////////
    /**
     * Returns the ids of the references in this group
     * /format/:ids
     * @param  {Object} req Express request object
     * @param  {Object} res Express response object
     * @return {void}
     */
    formatReferences : function(req,res)
    {
      api.getFormattedRefs(req.params.ids,req.params.style)
      .then(success(res))
      .catch(fail(res));
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
      .then(success(res))
      .catch(fail(res));
    },

    /**
     * Returns the data of the given reference as CSL input data
     * /get/:ids/:field
     * @param  {Object} req Express request object
     * @param  {Object} res Express response object
     * @return {void}
     */
    get : function(req,res)
    {
      api.get(req.params.ids,req.params.field)
      .then(success(res))
      .catch(fail(res));
    }
  }
};
