const _ = require("underscore");
const $ = require("string");



/**
 * BibSync service methods
 * @param  {Object} sandbox An object exposing the application API
 * @return {Object} An object exposing the service methods
 */
module.exports = function(sandbox)
{

  var console = sandbox.getConsole();
  var config  = sandbox.getConfig();
  var success = sandbox.success;
  var fail    = sandbox.fail;
  var enabledAPIs = sandbox.getEnabledApis();



  /**
   * In-memory cache
   * @type {Object}
   */
  var cache = {};

  /*
   Observe progress widget's cancel button
   TODO solve this in a more generic way
   */
  var cancelAction = false;
  sandbox.getSocket().then((socket)=>{
    socket.on("progress.cancel", function () {
      cancelAction = true;
    });
  });

  // Services
  var services = {
    /**
     * Return data on available libraries
     * /libraries
     * @param  {Object} req Express request Object
     * @param  {Object} res Express response Object
     * @return {void}
     */
    libraries: function(req, res) {
      var promises = [];
      for (var key in enabledAPIs) {
        promises.push(enabledAPIs[key].getLibraries());
      }
      Promise.all(promises)
        .then(function(values) {
          res.json(values.reduce(function(result, current) {
            return result.concat(current);
          }, []));
        })
        .catch(fail(res));
    },


    /**
     * Create a clean parameter object from the request parameters with information
     * on the source and target. Returns boolean false if source and target are identical
     *
     * @param  {Object} req Express request Object
     * @return {Object|false}
     */
    _getParameterObject : function(req)
    {
      var info = {
        source: {},
        target: {}
      };
      var props = "application,type,id,collectionKey".split(/,/);
      for (var key in info) {
        info[key] = {};
        props.forEach(function createProperty(prop) {
          var param = key + prop[0].toUpperCase() + prop.substring(1);
          info[key][prop] = req.params[param];
        });
      }

      var match = true;
      for( key in info.source )
      {
        if ( info.source[key] != info.target[key] ) match = false;
      }
      if( match ) return false;
      return info;
    },

    /**
     * Start the syncronization
     * /sync/:sourceApplication/:sourceType/:sourceId/:sourceCollectionKey/
     *   to/:targetApplication/:targetType/:targetId/:targetCollectionKey/:action
     * @param  {Object} req Express request Object
     * @param  {Object} res Express response Object
     * @return {void}
     */
    startSync: function(req, res) {

      var action = req.params.action;
      console.debug("Sync action: " + action);

      var info = services._getParameterObject(req);
      if ( info === false ) {
        return res.json({
          responseAction : "error",
          responseData   : "Source and target are identical",
          action         : ""
        });
      }

      //console.debug(info);
      var sourceApi = enabledAPIs[info.source.application];
      var targetApi = enabledAPIs[info.target.application];
      if( ! sourceApi || ! targetApi ){
        return res.status(400).send("Invalid application");
      }

      // assemble all information needed

      // get data from cache if possible
      var cacheId = [
        info.source.type, info.source.id, info.source.collectionKey,
        info.target.type, info.target.id, info.target.collectionKey ].join("|");
      cache[cacheId] = {
        collectionData : null,
        childCollectionDiff : null
      };
      if ( cache[cacheId].collectionData )
      {
        return syncAction( cache[cacheId].collectionData );
      }

      // get data from backends
      Promise.all([
        sourceApi.getCollections  ( info.source.type, info.source.id ),
        sourceApi.getCollection   ( info.source.type, info.source.id, info.source.collectionKey ),
        targetApi.getCollections  ( info.target.type, info.target.id ),
        targetApi.getCollection   ( info.target.type, info.target.id, info.target.collectionKey )
      ])
      .then( syncAction )
      .catch( abort );

      function abort(err)
      {
        console.warn(""+err);
        res.status(500).send(""+err);
      }

      /**
       * Compares two javascript objects by comparing selected properties
       * @param  {Object} item1           First ob
       * @param  {Object} item2           Second object
       * @param  {Array} fieldsToCompare An array of strings with the property names
       * @return {Boolean}                 Whether all properties match or not
       */
      function itemCompare ( item1, item2, fieldsToCompare )
      {
        return fieldsToCompare.every(function(field){
          return item1[field] == item2[field];
        });
      }

      /**
       * Compares two collections in the form of javascript arrays containing
       * javascript objects by comparing selected properties
       * of these objects.
       * @param  {Array} arr1 First collection
       * @param  {Array} arr2 Second collection
       * @param  {Array} fieldsToCompare An array of strings with the names of the
       * properties
       * @return {Array} Returns an array with items of the following structure
       * [ [ index1, item1 ], [index2, item2 ] ]. If the "same" object is present
       * in both collections, all elements of this structure exist. If it is only
       * present in the first or the second collection, only those elements are
       * populated, the other element is set with [null, null];
       */
      function itemsDiff ( arr1, arr2, fieldsToCompare )
      {
        var result = [];

        // common + removed right
        arr1.forEach(function(item1,index1){
          index2 = arr2.findIndex(function(item2){
            return itemCompare(item1,item2,fieldsToCompare);
          });
          if(index2 > -1) {
            result.push([[index1,item1],[index2,arr2[index2]]]);
          } else {
            result.push([[index1,item1],[null, null]]);
          }
        });

        // added right
        arr2.forEach(function(item2,index2){
          index1 = arr1.findIndex(function(item1){
            return itemCompare(item1,item2,fieldsToCompare);
          });
          if(index1 == -1) result.push([[null, null],[index2,item2]]);
        });
        return result;
      }

      /**
       * Transforms a native object with key-value-pairs into a qooxdoo data Array
       * containing qooxdoo objects with a "key" and a "value" property
       * @param  {Object|null} item The javascript object. If a falsy value is
       * passed, an empty array is returned.
       * @param {Array|undefined} keysToIgnore Optional array containing the names
       * of keys that should not be included in the return value
       * @return {qx.data.Array}
       */
      function keyValueize( item, keysToIgnore ){
        if ( ! item ) return [];
        return Object.keys(item)
          .filter(function(key){
            return ((keysToIgnore||[]).indexOf(key) == -1);
          })
          .map(function(key){
            return { key : key , value : item[key] };
          });
      }


      /**
       * Main synchronization process
       * @param  {Array} data
       * @return {void}
       */
      function syncAction(data)
      {
        // save to cache
        cache[cacheId].collectionData = data;

        info.source.collections = data[0]; // all collections in the source library
        info.source.collection  = data[1]; // the data of the specific collection to be synchronized
        info.target.collections = data[2];
        info.target.collection  = data[3];

        info.source.collection.children =
          sourceApi.getCollectionChildKeysSync( info.source.type, info.source.id, info.source.collectionKey );
        info.target.collection.children =
          targetApi.getCollectionChildKeysSync( info.target.type, info.target.id, info.target.collectionKey );

        var sourceChildKeys = info.source.collection.children;
        var targetChildKeys = info.target.collection.children;

        /*
          Action switch
         */
        switch (action) {

          /*
            START
           */
          case "start":
            if ( info.source.collection.name !== info.target.collection.name  ){
              return res.json({
                responseAction : "confirm",
                responseData   : "Collections have different names, continue?",
                action         : "startSyncCollections"
              });
            };

            // fallthrough if names match

          /*
            compare source and target subcollections
           */
          case "startSyncCollections":
          //
          //   console.log("Starting sync'ing of collections...");
          //   var diff = sourceChildKeys.length - targetChildKeys.length;
          //   if( diff > 0 ) {
          //     if( ! targetApi.canCreateCollection() ){
          //       // cannot create subcollections
          //       console.log("Target cannot create folders.");
          //       return res.json({
          //         responseAction : "confirm",
          //         responseData   : "The source collection has at least " + diff + " subcollections which cannot be created on the target. Continue anyways?",
          //         action         : "syncCollectionItems"
          //       });
          //     }
          //
          //     // will create subcollections
          //     console.log("Ask user if subcollections should be created.");
          //     return res.json({
          //       responseAction : "confirm",
          //       responseData   : "The source collection has at least " + diff + " subcollections which do not exist in the target. Create?",
          //       action         : "syncCollectionsCreateChildren"
          //     });
          //   }
          //   // fallthrough to next case
          //
          // /*
          //   ask the user if collections should be created
          //  */
          // case "syncCollectionsCreateChildren":
          //   console.log("User needs to confirm that subcollections should be created and populated.");
          //
          //   var sourceChildCollections = sourceChildKeys.map(function(collectionKey){
          //     return sourceApi.getCollectionSync( info.source.type, info.source.id, collectionKey );
          //   },this);
          //
          //   var targetChildCollections = targetChildKeys.map(function(collectionKey){
          //     return targetApi.getCollectionSync( info.target.type, info.target.id, collectionKey );
          //   },this);
          //
          //   var childCollectionsDiff = itemsDiff(sourceChildCollections,targetChildCollections,["name"]);
          //   cache[cacheId].childCollectionDiff = childCollectionsDiff;
          //
          //   var newCollectionNames = childCollectionsDiff.reduce(function(acc,item){
          //     if( item[0][1] && ! item[1][1] ) {
          //       acc.push( item[0][1].name );
          //     }
          //     return acc;
          //   },[]);
          //
          //   if( newCollectionNames.length )
          //   {
          //     return res.json({
          //       responseAction : "confirm",
          //       responseData   : "The following collections will be created: " + newCollectionNames.join(", ") + ". Proceed?",
          //       action         : "syncCollectionsCreateChildrenConfirmed"
          //     });
          //   }
          //
          //   // fallthrough
          // /*
          //   create the collections
          //  */
          // case "syncCollectionsCreateChildrenConfirmed":
          //
          //   var newChildCollections = cache[cacheId].childCollectionsDiff.reduce(function(acc,item){
          //     if( item[0][1] && ! item[1][1] ) {
          //       acc.push( item[0][1] );
          //     }
          //     return acc;
          //   },[]);
          //
          //   //... implement ...
          //
          // // fallthrough
          // //
          /*
            sync the content of the collection
           */
          case "syncCollectionItems":
            console.info("Syncing collection content...");

            Promise.all([
              sourceApi.getCollectionItems(
                info.source.type, info.source.id, info.source.collectionKey ),
              targetApi.getCollectionItems(
                info.target.type, info.target.id, info.target.collectionKey )
            ])
            .then(function(data){

              var result = itemsDiff(
                data[0],
                data[1],
                [ "title", "date" ]
              );

              var tableData = [];
              result.forEach(function(tuple){
                var index1 = tuple[0][0];
                var item1  = tuple[0][1];
                var index2 = tuple[1][0];
                var item2  = tuple[1][1];

                var keys = _.union( _.keys(item1), _.keys(item2) );
                var keysToIgnore = ["id","dateAdded","version"];
                var comparedKeys = _.difference( keys, keysToIgnore );

                // skip items if identical
                if( comparedKeys.every(function(key){
                  if( !item1 || !item2 ) return false;
                  return item1[key] == item2[key];
                })) return;

                // not identical
                tableData.push([
                  keyValueize(item1),
                  keyValueize(item2),
                  keys
                ]);
              });

              // delete cache
              delete cache[cacheId];

              // send items to client
              return res.json({
                responseAction : "startManualSync",
                responseData   : tableData,
                action         : ""
              });

            }).catch(abort);
            break;

          default:
            return res.json({
              responseAction : "alert",
              responseData   : "Unknown action: "+action,
              action         : ""
            });
        }
      }
    },

    /**
     * Copy one folder and its contents as a subfolder of another folder
     * @param  {Object} info An object containing all information
     * @return {Promise}
     */
    copyFolder : function(info) {
      var source = info.source;
      var target = info.target;
      //console.debug(info);
      if ( info === false ) {
        return res.status(400).send("Source and target are identical");
      }
      var sourceApi = enabledAPIs[source.application];
      var targetApi = enabledAPIs[target.application];
      if( ! sourceApi || ! targetApi ){
        return Promise.reject(new Error("Invalid application"));
      }
      sandbox.showProgress(0,"Assembling information...");
      var targetCollectionKey = null;
      return sourceApi.getCollection(source.type,source.id,source.collectionKey)
      .then(function(collection){
        var data = {
          name      : collection.name,
          parentKey : target.collectionKey
        };
        console.log("Writing collection '" + collection.name + "' to the server" );
        return targetApi.addCollection(target.type,target.id,data);
      })
      .then(function(newCollectionKey){
        console.debug("Received new collection key " + newCollectionKey );
        targetCollectionKey = newCollectionKey;
        console.debug("Loading source items...");
        return sourceApi.getCollectionItems( source.type, source.id, source.collectionKey );
      })
      .then(function(items){
        console.debug("Creating copies in target collection...");
        // serially iterate over data using promise-returning functions and array.prototype.reduce:
        // http://taoofcode.net/promise-anti-patterns/
        var numItems = items.length;
        var cancelMsg = false;
        return items.reduce(function( promise, itemData, index ){
          return promise.then(function(){
            // user pressed "cancel" button
            if( cancelAction ){
              if( ! cancelMsg ) {
                console.info("User cancelation...");
                cancelMsg = true;
              }
              sandbox.showProgress( (index/numItems)*100, "Aborting...");
              return Promise.resolve();
            }
            // continue
            sandbox.showProgress(
              (index/numItems)*100,
              "Copying " + (index+1) + " of " + numItems + " items.",
              itemData.title
            );
            itemData.info = JSON.stringify( info ); // TODO: info should be passed as parameter, this requires changeing the REST API as well
            if( source.application == target.application ){
              return targetApi.copyItem( target.type, target.id, itemData, targetCollectionKey );
            } else {
              return targetApi.createItem( target.type, target.id, itemData, targetCollectionKey );
            }
          });
        }, Promise.resolve());
      })
      .then(function(){
        sandbox.hideProgress();
        sandbox.hideProgress();
        cancelAction=false; // important!
        console.debug("Done.");
      })
      .catch(function(err){
        sandbox.hideProgress();
        sandbox.hideProgress();
        console.error(""+err);
      });
    },

    /**
     * TESTs
     * @type {Object}
     */
    test_createItem : function(){

      ///zotero/group/984485/items
      var info = {
        "source": {
          "application": "bookends",
          "id": 0,
          "type": "user",
          "collectionKey": "1b7185cec28a1e20e33f5f3ad0f02081"
        },
        "target": {
          "application": "zotero",
          "id": 984485,
          "type": "group",
          "collectionKey": "3VKSCZXV"
        }
      };
      var itemData = {
        itemType:"bookSection",
        authors:"Luhmann, Niklas",
        title:"Positives Recht und Ideologie",
        bookTitle:"Soziologische Aufklärung 2. Aufsätze zur Theorie der Gesellschaft",
        pages:"178-203",
        date:"1991",
        publisher:"Westdeutscher Verlag",
        place:"Opladen",
        key:"Luhmann-1991-Positives",
        pubmedId:"3355",
        attachments:"Luhmann-1991-Positives.pdf",
        dateAdded:"2011-08-26",
        collections:"Autonomy of Law;Ideology",
        info : JSON.stringify( info ) // TODO this is dumb
      };
      var target = info.target;
      enabledAPIs[ target.application]
        .createItem( target.type, target.id, itemData, target.collectionKey );
    },
    
    
    /**
     * Creates chapters from the edited volumes in a given folder
     */
    createChaptersFromToc : async function(info){
      
      console.debug(info);
      
      const fs = require("fs");
      const download = require('download');
      const request = require('request');
      const scissors = require("scissors");
      
      const Zotero = require('../../lib/libZoteroJS/src/libzotero');
      // main logic
      try{
        // load all items in the collection
        const library = new Zotero.Library(info.type+"s",info.id,null,config.zotero.apiKey);
        const collectionKey = info.collectionKey;
        let response = await library.loadItems({collectionKey});
        let bookItems = response.loadedItems;
        
        // iterate over book items
        for ( let bookItem of bookItems ){
          if( bookItem.get('itemType') !== "book" ) {
            console.debug(`>>> Skipping "${bookItem.get('title')}": not a book.`);
            continue;
          }
          await createBookChapters(bookItem);
          if( cancelAction ){
            cancelAction=false;
            break;
          }
        } 
      } catch (e) {
        sandbox.clientError(e.message);
      }
      
      async function createBookChapters( bookItem ){
        let title  = bookItem.get("title");
        console.debug(`>>> Getting info for "${title}"...`);
        
        // parse the notes for chapter data and collect attachments
        let [chapters,attachmentItems] = await analyzeBookAttachments( bookItem );
        
        // does the book item have chapter information?
        if( chapters.length === 0) {
          console.debug(">>> No chapter information. Skipping.");
          return;
        }
        console.debug(`>>> Found ${chapters.length} chapters in TOC.`);

        // create chapter items
        let chapterItems = await createChapters( bookItem, chapters );
        console.log(`>>> Created ${chapterItems.length} chapter items.`);
        
        var fileData = findBookPdfAttachment( attachmentItems );
        if ( !fileData ) {
          console.debug(">>> No PDF Attachment. Saving chapters only.");
          await library.items.writeItems(chapterItems);
          return;
        } 
        
        try {
          // download attachment
          var filePath = await downloadAttachment( fileData );
          console.debug(`>>> ${fileData.title} has been downloaded to ${filePath}`);  
  
          // get first page in PDF
          let offset = await getOffset(bookItem);
          if ( ! offset ){
            console.debug(">>> Invalid user input for offset.");
            return;
          }
          
          // create chapter items and chapter attachments
          let index = 0;
          for ( var chapterItem of chapterItems ){
            try {
              
              if( cancelAction ){
                console.log("!!! User cancelation.");
                return; 
              }
              
              let title = chapterItem.get('title');
              sandbox.showProgress(100*(index++/chapterItems.length), `Creating Chapter "${title}"`);
              
              // check page range
              //var [firstPage,lastPage] = await checkPageRange(chapterItem, filePath, offset );

              // extract PDF
              var chapterPdf = await extractChapterPdf( chapterItem, filePath, offset);
              console.debug(`>>> Extracted chapter to ${chapterPdf}.`);
              
              // create attachment item
              let chapterAttachmentItem = await createAttachmentItem( chapterItem, filePath );
              console.debug(">>> Attachment created.");
             
              // write items to Zotero
              chapterItem = await saveItem(chapterItem);
              let chapterKey = chapterItem.get('key');
              console.debug(`>>> Chapter item saved to Zotero server (${chapterKey}).`);
              chapterAttachmentItem.set('parentItem', chapterKey );
              chapterAttachmentItem = await saveItem(chapterAttachmentItem);
              let chapterAttachmentKey = chapterAttachmentItem.get('key');
              console.debug(`>>> Chapter attachment item saved to Zotero server (${chapterAttachmentKey}).`);
              
              // upload PDF
              await uploadFile( chapterAttachmentItem, chapterPdf );
              console.debug(">>> PDF uploaded.");  
              
            } catch (e) {
              console.error(`!!! Problem creating chapters: ` + e.message);
            } finally {
              fs.unlinkSync(chapterPdf);
            }
          } // end for-of chapters
        } catch(e) {
          console.error(`!!! Error creating "${bookItem.get('title')}"`);
        } finally {
          sandbox.hideProgress();
          fs.unlinkSync(filePath);
        }
      }
      

      /**
       * Return chapter data and attachment items
       * @param {Zotero.Item}
       * @return {Promise} Promise that resolves with an array, first element is
       * an array with data on the chapters, seconde element is an array of 
       * Zotero.Items of type "attachment"
       */
      async function analyzeBookAttachments( book ){
        // retrieve child item data
        let childItems = await book.getChildren(library);
        let chapters = [], attachments=[];
        for ( let childItem of childItems ){
          switch (childItem.get("itemType")) {
            // look for a TOC in the notes
            case "note":
            let note = $(childItem.get("note")).stripTags().toString();
            let lines = note.split(/\n/);
            let prefix = "[bibsync-toc:", separator="\\|";
            // do we have a table of contents?
            if( lines.length > 2 && lines[1].substr(0,prefix.length) == prefix) {
              // yes, get pattern
              let pattern = lines[1].substring(prefix.length, lines[1].lastIndexOf("]") );
              let fields = pattern.split(new RegExp(separator));
              // analyze rest of the note, starting with line 3
              lines.slice(2).forEach((line)=>{
                let chapter = {};
                let parts = line.split(new RegExp(separator));
                if( parts.length === fields.length ){
                  parts.map((part,index)=>{
                    chapter[fields[index]] = $(part).trim().toString();
                  });
                  chapters.push(chapter);                    
                }
              });
            }
            break;
            // save attachment data if we have a PDF
            case "attachment":
            attachments.push(childItem);
            break;
          }
        }
        return [chapters, attachments];
      }
      
      // find main attachment - will use the first PDF attachment      
      function findBookPdfAttachment(attachmentItems){
        var fileData=false;
        for (let attachmentItem of attachmentItems ){
          console.debug(`>>> Looking at attachment "${attachmentItem.get('title')}"...`);
          fileData = attachmentItem.apiObj.links.enclosure;
          // skip all non-pdf attachments
          if ( fileData.type != "application/pdf" ){
            console.debug(">>> Is not a PDF, skipping...");
            continue;
          }
          break;
        }
        if( ! fileData ){
          throw new Error("No main PDF.");
        }
        return fileData;
      }      
      
      /**
       * Creates chapters from the TOC data
       * @param {Zotero.Item} bookItem
       * @param {Array} chapters
       * @param {Promise} A promise that resolves with an Array of {Zotero.Item} 
       * object that have not been saved to the Zotero server yet. 
       */
      async function createChapters ( bookItem, chapters ){
        let lastPage = false, index = 0, chapterItems = [];
        for (let chapterData of chapters){
          var chapterItem = new Zotero.Item();
          chapterItem.associateWithLibrary(library);
          await chapterItem.initEmpty("bookSection");
          // creators
          let creators = parseCreators(chapterData.authors||"").concat(bookItem.get("creators"));
          // pages
          let pages = parsePages(chapterData.pages);
          if(pages.length == 1 && index < chapters.length -1 && chapters[index+1].pages){
            let nextChapterPages = parsePages(chapters[index+1].pages);
            index++;
            if(nextChapterPages[0]){
              pages.push(nextChapterPages[0]-1);
            } 
          }
          // set chapter data
          chapterItem
          .set("creators", creators)
          .set("bookTitle", bookItem.get("title") )
          .set("title", chapterData.title )
          .set("pages", pages.join("-"));
          let copyFields = ["volume","numberOfVolumes","edition","place","publisher","date","language","ISBN"];
          for( let field of copyFields ){
            chapterItem.set(field, bookItem.get(field) );
          }
          // collection
          chapterItem.set("collections",[collectionKey]);
          // relations
          // chapter.set("relations", {
          //   "dc:relation" : book.apiObj.links.alternate.href
          // });
          chapterItems.push(chapterItem);
        }
        return chapterItems;
      }
      
      /**
       * Downloads the file from the Zotero server to a temporary file
       * @param {Array} fileData
       * @param {Promise} A promise that resolves with file paths to the downloaded PDFs
       */
      async function downloadAttachment( fileData ){
        var filePath = tempPath(".pdf");
        let url = fileData.href.replace(/\/view/,"") + "?key=" + config.zotero.apiKey;
        console.debug(`>>> Downloading ${fileData.title} from ${url} ...`);
        await download(url).pipe(fs.createWriteStream(filePath));  
        return filePath;
      }
      
      
      async function checkPageRange( chapterItem, filePath, offset ){
        
        var socket = await sandbox.getSocket();
        
        // get first / last from chapter 
        var [firstPage,lastPage] = chapterItem.get('pages').split(/\-/).map((page)=>parseInt(page)+offset);
        
        // image files
        let leftImage  = "leftImage.png";
        let rightImage = "rightImage.png";
        
        // create images on the fly
        async function createImage( page, filename){
          await new Promise((resolve,reject)=>{
            scissors(filePath).range(page).pngStream(200)
            .pipe(fs.createWriteStream("./tmp/" + filename))
            .on("close", ()=>{ resolve() })
            .on("error", (e)=>{ reject(e) });
          });
        }
        
        // update the images
        async function updateImages(){
          await createImage( firstPage, leftImage );
          await createImage( lastPage, rightImage );
          let text = "Please check if the first and the last page are correct or select accordingly. Then press OK.";
          socket.emit("pdfview.show",{
            leftImage: `${leftImage}?${Math.random()}`, 
            rightImage : `${rightImage}?${Math.random()}`, 
            text
          });
          console.debug(`>>> first page: ${firstPage}, last page:${lastPage}.`);
        }
        
        // events
        if( ! this.__pdfviewer_events){
          socket.on("pdfview.changePage",(m)=>{
            if( "left" in m ){
              firstPage += m.left;
            }
            if( "right" in m ){
              lastPage += m.right;
            }
            updateImages();
          });
          this.__pdfviewer_events = true;
        }
        // show on client
        updateImages();
        await (new Promise((resolve)=>{
          socket.once("pdfview.ok",resolve);
        }));
        return [firstPage, lastPage];
      }
      
      /**
       * Returns the offset between the first PDF page and "page 1" of the book.
       * @param {Zotero.Item} bookItem
       * @return {Promise} A promise that resolves with the page number or false if there was a problem
       */
      async function getOffset(bookItem){
        let page1 = await sandbox.promptUser(`Please enter the page in ${bookItem.get('title')} that is page 1 of the book`);
        if( ! page1 ) {
          console.debug(">>> User cancelation.");
          return false;
        }
        page1= parseInt(page1);
        if(page1===0 || isNaN(page1)){
          sandbox.clientError("Invalid page number!");
          return false;
        }
        return page1-1;
      }
      
      /**
       * Returns the last page in the PDF 
       * @param {Zotero.Item} bookItem
       * @return {Promise} A promise that resolves with the page number or false if there was a problem
       */
      async function getLastPage(bookItem){
        let lastPage = await sandbox.promptUser(`Please enter the last page of ${bookItem.get('title')}.`);
        if( ! lastPage ) {
          console.debug(">>> User cancelation.");
          return false;
        }
        lastPage= parseInt(lastPage);
        if(lastPage===0 || isNaN(lastPage)){
          sandbox.clientError("Invalid page number!");
          return false;
        }
        return lastPage;
      }      
      
      /**
       * Split the chapter part from the main PDF on the basis of the page information in 
       * the chapter item
       * @param {Zotero.Item} chapterItem A  Zotero.Items object containing the metadata on the given chapter
       * @param {String} bookFilePath The path to the PDF from which to spit the chapter attachment
       * @param {Number} offset The number of pages that have to be added to the PDF page number to get to page 1 of the book (after TOC, foreword, etc.)
       * @return {Promise} A promise that resolves with the paths to the created PDF
       */
      async function extractChapterPdf( chapterItem, bookfilePath, offset){
        const fs = require('fs');
        let [firstPage,lastPage] = chapterItem.get('pages').split("-").map((page)=>parseInt(page));
        if( ! lastPage ){
          lastPage = await getLastPage();
        }
        if( ! firstPage || isNaN(firstPage) || !lastPage || isNaN(lastPage) ) {
          throw new Error(`Invalid page numbers for chapter ${chapterItem.get('title')}: ${chapterItem.get('pages')}`);
        }
        let firstPagePdf = firstPage + offset;
        let lastPagePdf  = lastPage + offset;
        console.debug(`>>> extracting pages ${firstPage}-${lastPage} (${firstPagePdf}-${lastPagePdf} in the PDF...)`);
        let chapterFilePath = tempPath(".pdf");
        try {
          await new Promise((resolve,reject)=>{
            scissors(bookfilePath).range(firstPagePdf,lastPagePdf).pdfStream()
            .pipe(fs.createWriteStream(chapterFilePath))
            .on("close", ()=>{ resolve() })
            .on("error", (e)=>{ reject(e) });
          });
        }
        catch(e){
          throw new Error(`Error extracting chapter to ${chapterFilePath}:` + e.message);
        }
        return chapterFilePath;
      }
      
      // unused
      async function getPageText( filePath, page ){
        var text = "";
        await new Promise((resolve,reject)=>{
          scissors(filePath).textStream()
          .on('data', (data)=>{ text += data; })
          .on("error", (e)=>{ reject(e); })
          .on("end", ()=>{ resolve(); });
        });
        console.debug(text);
        return text;
      }      
      
      // unused
      async function createThumbnail( filePath ){
        let pngFile = filePath.replace(/\.pdf/,"")+ ".png";
        await new Promise((resolve,reject)=>{
          scissors(filePath).range(1).pngStream(200)
          .pipe(fs.createWriteStream(pngFile))
          .on("close", ()=>{ resolve() })
          .on("error", (e)=>{ reject(e) });
        });
        console.debug(`>>> '${pngFile}' has been written to disk.`);
        return pngFile;
      }
      
      /**
       * Creates an attachment item for the given item object. This does not 
       * upload the file or write the item to the server.
       * @param {Zotero.Item} item 
       * @param {String} filePath
       * @return {Promise} A promise resolving with the created item.
       */
      async function createAttachmentItem( item, filePath ){
        let title = item.get('title');
        let attachmentItem = new Zotero.Item();
        attachmentItem.associateWithLibrary(item.owningLibrary);
        await attachmentItem.initEmpty('attachment', 'imported_file');
        attachmentItem.set('title', title )
        attachmentItem.set('filename', title.substring(0,30).concat(".pdf") );
        attachmentItem.set('contentType', "application/pdf");
        return attachmentItem;
      }
    
      /**
       * Uploads the given file to the Zotero server
       * @param {Zotero.Item} item
       * @param {String} file path
       * @return {Promise} 
       */
      async function uploadFile ( item, filePath ){
        // request authorization 
        let options = {
          url: `https://api.zotero.org/groups/${groupId}/items/${item.get('key')}/file`,
          headers : {
            "Authorization": "Bearer " + config.zotero.apiKey
          }
        };
        console.debug(">>> Requesting upload authorization for " +  options.url );
        let fileStat = fs.statSync(filePath);
        options.form = {
          md5     : require('md5-file').sync(filePath),
          filename: item.get("filename"),
          filesize: fileStat.size,
          mtime   : fileStat.mtime.getTime()
        };
        options.headers["If-None-Match"] = "*";
        
        let uploadConfig = await (new Promise((resolve,reject)=>{
          request.post(options,function(err, response, body){
            if( response.statusCode === 200){
              var result = JSON.parse(body);
              return resolve(result);
            } else if ( ! err ) {
              err = new Error( "HTTP Error Code " + response.statusCode + ": " + body );
            }
            console.debug(response);
            console.debug(options);
            reject(err);
          });
        }));
        
        if( uploadConfig ){
          console.debug(">>> Received upload authorization...");  
        } else {
          throw new Error("Problem getting upload authorization.");
        }
        
        // return if file already exists
        if ( uploadConfig.exists ) return true;
        
        // upload file
        var uploadSize = (fileStat.size + uploadConfig.prefix.length + uploadConfig.suffix.length);
        options = {
          url : uploadConfig.url,
          headers : {
            "Content-Type"   : uploadConfig.contentType,
            "Content-Length" : uploadSize
          }
        };
        var bytes = 0;
        await (new Promise((resolve, reject)=>{
          var writeStream = request.post(options)
          .on("error", reject )
          .on('response', function(response) {
            switch( response.statusCode ){
              case 201:
              case 204:
              console.debug(">>> Upload completed. Bytes written: " + bytes);
              return resolve(true); // SUCCESS
              default:
              var err = "Http Error " + response.statusCode + ": " + response.headers;
              throw new Error(err);
            }
          });
          // Create ReadStream and pipe into WriteStream
          var multiStream = require('multistream');
          var intoStream  = require('into-stream');
          var streams = [
            intoStream(uploadConfig.prefix),
            fs.createReadStream( filePath ),
            intoStream(uploadConfig.suffix)
          ];
          multiStream(streams)
          .on("error", (err)=>{ throw err })
          .on("data",function(chunk){
            bytes += chunk.length;
            //sandbox.showFileProgress(bytes/uploadSize*100,"Uploading "+ filename );
            //console.debug("Sent " +  bytes + " of " + uploadSize + " bytes of data.");
          })
          .pipe( writeStream );
        }));
        console.debug(">>> Upload successful.");

        // upload registration
        console.debug(">>> Registering upload with Zotero storage ...");
        options = {
          url: `https://api.zotero.org/groups/${groupId}/items/${item.get("key")}/file`,
          headers : {
            "If-None-Match" : "*",
            "Authorization" : "Bearer " + config.zotero.apiKey
          },
          form :  { upload : uploadConfig.uploadKey}
        };
        await (new Promise(function(resolve, reject){
          request.post(options,function(err, response, body){
            if ( err ) return reject (err);
            switch( response.statusCode){
              case 200:
              case 204:
              return resolve(true);
              default:
              throw new Error("HTTP Error " + response.statusCode + ": " + body );
            }
          });
        }));
        console.debug(">>> Upload registered.");
      }
      
      /**
       * Saves a Zotero.Item object to the server
       * @param {Zotero.Item} item
       * @return {Promise} A Promise that resolves with the item key
       */
      async function saveItem(item) {
        try {
          let result = await item.writeItem();
          return result[0].returnItems[0];
        } catch (e) {
          throw new Error(`Saving "${item.get('title')}" failed.`);
        }
      }
        
      function tempPath ( ext="" ){
        return "./tmp/" + require("uuid")() + ext;
      }
      
      function parsePages ( str ){
        let pages = str.split(/(\-|—)/g);
        return pages.map((page)=>$(page).trim().toString()).filter((page)=>page!="-"); 
      }
      
      /**
       * eurocentric author parser. (Naively)  assumes that the last part of the name  
       * is the last name. That shold work in 80% of cases, the rest has to be 
       * corrected by hand. Won't work for the majority of non-western names. 
       * @param {String} str
       * @return {String}
       */
      function parseCreators(str,creatorType="author"){
        let creators = [];
        let names = str.split(/(&|und|and|\/|;)/);
        names.forEach((name)=>{
          let lastSpace = name.lastIndexOf(" ");
          creators.push({
            creatorType,
            firstName : $(name).substr(0,lastSpace).trim().toString(),
            lastName  : $(name).substr(lastSpace).trim().toString()
          });
        });
        return creators;
      }
    
    },
    
    
    

  };
  return services;
};
