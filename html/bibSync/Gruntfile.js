// requires
var util = require('util');
var qx = require("../../lib/qooxdoo-5.0/tool/grunt");

// grunt
module.exports = function(grunt) {
  var config = {

    generator_config: {
      let: {
      }
    },

    common: {
      "APPLICATION" : "bibsync",
      "QOOXDOO_PATH" : "../../lib/qooxdoo-5.0",
      "LOCALES": ["en"],
      "QXTHEME": "bibsync.theme.Theme"
    }

    /*
    myTask: {
      options: {},
      myTarget: {
        options: {}
      }
    }
    */
  };

  var mergedConf = qx.config.mergeConfig(config);
  // console.log(util.inspect(mergedConf, false, null));
  grunt.initConfig(mergedConf);

  qx.task.registerTasks(grunt);

  // grunt.loadNpmTasks('grunt-my-plugin');
};
