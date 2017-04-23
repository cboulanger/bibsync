/**
 * Amazon S3 file store plugin
 *
 * @param  {Function} done Callback function to be called when plugin
 * is configured.
 * @return {void}
 */
module.exports = function s3(bibsync,done){
  var sandbox   = bibsync;
  var console   = sandbox.getConsole();
  console.debug('Loaded Amazon S3 plugin (does nothing currently).');
  done(null,this);
};
