//
// This library defines a Bookends function methods to retrieve or
// manipulate Bookends data
//
// Original author ComplexPoint on https://www.sonnysoftware.com/phpBB3/viewtopic.php?f=2&t=4017
// Adaptation: Christian Boulanger
//

var osascript = require('node-osascript');
var Promise   = require('promise');
var md5       = require('md5');

var types     = require("../mappings/types");
var fields    = require("../mappings/fields");

var i=1;
[4,8,14,15,16,19,20].forEach(function(n){
  var fieldName = "custom"+i;
  fields[fieldName] = { RIS : "C"+ (i++), bibtex : false, bookends : "user"+n,  label : "Custom " + n };
});


// index of Bookends' fields
bookends_fields = {};
for( var key in fields)
{
  bookends_fields[fields[key].bookends] = key;
  switch (key) {
    case "type":
      fields[key].bookendsDbCol = "[type]"; break;
    case "pages":
      fields[key].bookendsDbCol = "[pages]"; break;
    case "year":
      fields[key].bookendsDbCol = "thedate"; break;
    default:
      fields[key].bookendsDbCol = key; break;
  }
}

// index of Bookends' types
var bookends_types = {};
for (var key in types )
{
  var bookends_type =  types[key].bookends;
  if ( bookends_type )
  bookends_types[bookends_type] = key;
}

//console.dir(fields);

// eventCode :: String -> String
function eventCode(strCode) {
    return 'tell application "Bookends" to «event ToyS' + strCode + '»';
}

/**
 * Execute a command via OSA and process the result
 * @param OSACommand {String}
 * @param splitChar {String|false|undefined}
 *    If string, split the result at the occurrences of this string
 *    If false, split by "\r" and re-join with "\n"
 *    If undefined, split with "\r"
 * @return {String}
 */
function evalOSA(OSACommand, splitChar, transformFunc ) {
    return new Promise(function(resolve, reject) {
        console.log(OSACommand);
        osascript.execute(OSACommand, {},
            function(err, result, raw) {
                if (err) {
                    console.log("Error: " + err);
                    return reject(err);
                }
                // transform
                if( typeof transformFunc == "function" )
                {
                  result = transformFunc(result);
                }
                // split
                result = result.split(new RegExp(splitChar || "\r"));
                resolve(result);
            }
        );
    });
}

/**
 * Module exports
 */
module.exports = {

    // customGroupNames :: () -> [String]
    getCollections: function(withFullPath) {
        var args = withFullPath ? ' given «class PATH»: "true"' : "";
        return new Promise(function(resolve,reject)
        {
          evalOSA(eventCode('RGPN') + args, "\r", function(result){
            return result.substring(1, result.length - 2);
          }).then( function(result){
            var map = {};
            for ( var j=0; j<result.length; j++)
            {
              var collectionName=result[j];
              // escape "/"
              collectionName = collectionName.replace(/\/\//, "<<slash>>");
              var slugs = collectionName.split(/\//);
              //...
              for ( var i=slugs.length-1; i>=0; i--)
              {
                var slug = slugs[i].replace(/<<slash\>\>/,"/");
                var key  = md5(slug);
                map[key] = {
                  key     : key,
                  name    : slug,
                  parent  : i>0 ? slugs[i-1] : false,
                  version : false
                };
              }
            }
            resolve(map);
          }).catch(function(err){
            reject(error);
          });
        });
    },

    // groupIDs :: String -> [String]
    // "All". "Hits", "Attachments", "Selection" or custom group name
    getCollectionIDs: function(strGroupName) {
      var args = ' "' + (strGroupName || '') + '"';
      return evalOSA(eventCode('RUID') + args, "\r", function(result){
        return result.substring(1, result.length - 2);
      });
    },

    // formattedRefs :: [String] -> maybe String -> String
    getFormattedRefs: function(ids, style, splitChar) {
      var args = ' "' + (ids instanceof Array ? ids : [ids]).join(',') +
        '" given «class RRTF»:"false", string:"' + (style || '') + '"';
      return evalOSA( eventCode('GUID') + args, "\r\r\r" , function(result){
        return result.substring(1, result.length - 2);
      });
    },

    // formattedRefs :: [String] -> maybe String -> String
    getReferenceData: function(ids) {
      var that = this;
      return new Promise(function(resolve, reject) {
        that.getFormattedRefs(ids,"Export")
          .then(function(result){
            var data = [];
            result.forEach(function(taggedData){
              var dict = {};
              var fieldName = "";
              taggedData.split(/\r/).map(function(line){
                var i = line.indexOf(":");
                var maybeFieldName = line.substring(0,i);
                if ( bookends_fields[maybeFieldName] ){
                  fieldName = bookends_fields[maybeFieldName];
                  if ( typeof fieldName == "function" )
                  {
                    fieldName = fieldName(dict);
                  }
                  dict[fieldName] = line.substring(i+2);
                } else if ( fieldName && bookends_fields[maybeFieldName] === undefined ) {
                  if ( line.length > 0 || fieldName=="abstract" || fieldName =="notes" ) {
                    dict[fieldName] += "\n" + line;
                  }
                }
              });
              dict.type = bookends_types[dict.type] || "journalArticle";
              if( fieldName ){
                data.push(dict);
              }
            });
            resolve(data);
          })
          .catch(reject);
        });
    },

    // modificationDates :: [String] -> [Date]
    getModificationDates: function(ids) {
      var args = ' "' + (ids instanceof Array ? ids : [ids]).join(',') + '"';
      return new Promise(function(resolve, reject) {
        evalOSA(eventCode('RMOD') + args, String.fromCharCode(0))
          .then(function(result) {
            resolve(result.map(function(s) {
                return new Date(
                    // Need Unix (1970) milliseconds (not 1904 seconds) for JS:
                    // (drop 66 years of seconds, and convert to milliseconds)
                    (parseInt(s, 10) - 2.0828448E+9) * 1000
                );
            }));
          })
          .catch(function(err) {
              reject(err);
          });
      });
    },

    // return «event ToySADDA» "/Users/username/Desktop/myPaper.pdf" given
    // «class RIST»:"TY - JOUR" & return & "T1 - The Title" & return &
    // "AU - Harrington Joseph" & return & "PY - 2015" & return &
    // "UR - http:// www.sonnysoftware.com" & return

    add: function(data) {
      var args = "";
      if( data.attachments )
      {
        args += '"' + data.attachments + '"';
      }
      if (data.type)
      {
        args += ' given «class RIST»:"';
      }
      for( var key in data )
      {
        if (key == "attachments") continue;

      }


        return evalOSA(eventCode('ADDA') + args, '\n');
    },


    // fieldContents [String] -> maybe String -> String
    // authors, title, editors, journal, volume, pages, thedate,
    // publisher, location, url, title2, abstract, notes, user1...user20
    get: function(ids, maybeFieldName) {
      if( maybeFieldName && fields[maybeFieldName] )
      {
        maybeFieldName = fields[maybeFieldName].bookendsDbCol;
      }
      var idsStr = ' "' + (ids instanceof Array ? ids : [ids]).join(',');
      var fieldNameStr = '"' + (maybeFieldName ? (' given string:' + '"' + maybeFieldName + '"') : '');
      return evalOSA(eventCode('RFLD') + idsStr + fieldNameStr, String.fromCharCode(0), true, function(value){
        return ( fieldNameStr == "[type]" ) ? bookends_types[value] : value;
      });
    },

    // fieldWrite :: String -> String -> String -> ()
    // authors, title, editors, journal, volume, pages, thedate,
    // publisher, location, url, title2, abstract, notes, user1...user20
    set: function(strID, strFieldName, strValue) {
        var args = ' "' + strID + '" given «class FLDN»:"' + strFieldName + '", string:"' + strValue + '"';
        return evalOSA(eventCode('SFLD') + args);
    },


    // sqlMatchIDs :: String -> [String]
    // SELECT clause without the leading SELECT keyword
    sqlMatchIDs: function(strClause) {
        return evalOSA(eventCode('SQLS') + ' "' + strClause + '"');
    },





};
