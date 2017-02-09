var config = require("../config.js");
var enabledAPIs = {};

for( var key in config )
{
  if (config[key].enabled)
  {
    enabledAPIs[key] = require("../api/"+key);
  }
}


module.exports =
{
  /**
   * Return the data of available libraries
   * /sync/libraries
   */
  libraries : function(req, res) {
    var promises = [];
    for( key in enabledAPIs )
    {
      promises.push( enabledAPIs[key].getLibraries() );
    }
    Promise.all(promises)
      .then(function(values){
        res.json(values.reduce(function(result,current){
          return result.concat(current);
        },[]));
      })
      .catch(function(err){
        res.status(500).send(err);
      });
  },


};
