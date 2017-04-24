/**
 *
 * @asset(bibsync/*)
 * @asset(qx/decoration/Modern/arrows-combined.png)
 * @asset(qx/icon/Tango/22/places/folder-open.png)
 * @asset(qx/icon/Tango/22/places/folder.png)
 * @ignore(confirm)
 * @require(qx.ui.tree.VirtualTree)
 * @require(qx.ui.form.SelectBox)
 *
 * TODO Add clear cache button
 */
qx.Class.define("bibsync.Application", {
  extend: qx.application.Standalone,

  /*
   *****************************************************************************
   PROPERTIES
   *****************************************************************************
   */
  properties: {
    progressWidget: {
      check: "dialog.Progress",
      init: null,
      nullable: false
    }
  },

  /*
   *****************************************************************************
   MEMBERS
   *****************************************************************************
   */
  members: {
    // simple properties
    __restResources: [],
    __formComponent: null,

    /**
     * Entry point
     * @return {void}
     */
    main: function() {
      this.base(arguments);

      // Enable logging in debug variant
      if (qx.core.Environment.get("qx.debug")) {
        // support native logging capabilities, e.g. Firebug for Firefox
        qx.log.appender.Native;
      }

      this.setupUI();
    },

    /**
     * create main form component, calls this.init() when done
     * @return {void}
     */
    setupUI: function() {
      // render main layout
      // TODO - use loadForm() instead?
      qookery.contexts.Qookery.loadResource(
        "bibsync/forms/application.xml",
        this,
        function(xmlSource) {
          var xmlDocument = qx.xml.Document.fromString(xmlSource);
          var parser = qookery.Qookery.createFormParser();
          try {
            var formComponent = parser.parseXmlDocument(xmlDocument);
            this.getRoot().add(formComponent.getMainWidget(), {
              left: 0,
              top: 0,
              right: 0,
              bottom: 0
            });
            this.__formComponent = formComponent;
          } catch (e) {
            this.error("Error parsing application root form", e);
          } finally {
            parser.dispose();
          }

          /*
           Socket.io communication
           */
          var socket = io();
          this.createProgressWidgets(socket);

          /**
           * Binds an event name to a class method
           * @param  {String} eventName The name of the event bound to the method
           * @param  {function} method The given function
           * @return {void}
           */
          function bindRpcMethod(eventName, method) {
            socket.on(eventName, function(args, done) {
              var result = method(args);
              if (result instanceof Promise) {
                result.then(done).catch(function(e) {
                  done({ error: "" + e });
                });
              } else {
                throw new Error("RPC methods must return a promise!");
              }
            });
          }

          /**
           * Call a RPC method on the server
           * @param  {String} eventName The name of the event bound to the method
           * @param  {Object} args   A map of named Arguments
           * @return {Promise} A promise resolving with the result of the method
           */
          this.callServerMethod = function(eventName, args) {
            return new Promise(function(resolve, reject) {
              socket.emit(eventName, args, function(result) {
                if (
                  result &&
                  typeof result == "object" &&
                  result.error !== undefined
                ) {
                  reject(result.error);
                } else {
                  resolve(result);
                }
              });
            });
          };

          // test it
          this.callServerMethod("test-success").then(function(result) {
            if (result == "RPC test successful") {
              console.info(result);
            } else {
              console.warn("RPC test failed.");
            }
          });

          // initialize if succesful
          this.init();
        }
      );
    },

    /**
     * Creates progress widgets to display progress of server action
     * @param  {[type]} io [description]
     * @return {[type]}    [description]
     */
    createProgressWidgets: function(socket) {

      var progressWidget = new dialog.Progress();
      var fpw = new dialog.Progress();

      // Progress Widget
      this.setProgressWidget(progressWidget);
      progressWidget.set({
        caption: "Processing entries",
        allowCancel: true
      });
      progressWidget.addListener(
        "cancel",
        function() {
          this.callServerMethod("progress.cancel");
        },
        this
      );
      socket.on("progress.show", function(m) {
        if (m && typeof m == "object") {
          progressWidget.set(m);
          if (!progressWidget.isVisible()) {
            fpw.hide();
            progressWidget.setEnabled(true);
            progressWidget.show();
          }
        } else {
          progressWidget.hide();
        }
      });

      // File Progress Widget
      fpw.set({
        caption: "File transfer",
        allowCancel: true
      });
      fpw.addListener(
        "cancel",
        function() {
          this.callServerMethod("progress.cancel");
        },
        this
      );
      socket.on("fileprogress.show", function(m) {
        if (m && typeof m == "object") {
          fpw.set(m);
          if (!fpw.isVisible()) {
            progressWidget.hide();
            fpw.setEnabled(true);
            fpw.show();
          }
        } else {
          fpw.hide();
        }
      });
    },

    /**
     * Creates and/or returns a qx.io.rest.Resouce responsible for retrieving
     * data for form components.
     * TODO sync and copy actions should be POST
     * @param  {String} name Unique name of the Resource
     * @return {qx.io.rest.Resource}      The resource
     */
    getRestResource: function(name) {
      if (!this.__restResources[name]) {
        var resource = new qx.io.rest.Resource({
          getLibraries: {
            method: "GET",
            url: "/libraries"
          },
          getTreeData: {
            method: "GET",
            url: "/{application}/{type}/{id}/collections/tree"
          },
          getTableData: {
            method: "GET",
            url: "/{application}/{type}/{id}/collections/{collectionKey}/summary"
          },
          sync: {
            method: "GET",
            url: "/sync/{sourceApplication}/{sourceType}/{sourceId}/{sourceCollectionKey}" +
              "/to/{targetApplication}/{targetType}/{targetId}/{targetCollectionKey}/{action}"
          },
          removeCollectionItem: {
            method: "DELETE",
            url: "/{application}/{type}/{id}/collections/{collectionKey}/items"
          },
          copyItem: {
            method: "PUT",
            url: "/{application}/{type}/{id}/items"
          },
          createItem: {
            method: "POST",
            url: "/{application}/{type}/{id}/items"
          },
          updateItem: {
            method: "PATCH",
            url: "/{application}/{type}/{id}/items"
          },
          test: {
            method: "GET",
            url: "/test"
          }
        });
        resource.addListener(
          "error",
          function(e) {
            qx.core.Init.getApplication().getRoot().setEnabled(true);
            resource.dispose();
            delete this.__restResources[name];
            console.warn(e.getData());
            dialog.Dialog.error("Server Error: " + e.getData());
          },
          this
        );
        resource.configureRequest(function() {
          qx.core.Init.getApplication().getRoot().setEnabled(false);
        }, this);
        resource.addListener(
          "success",
          function(e) {
            qx.core.Init.getApplication().getRoot().setEnabled(true);
          },
          this
        );
        this.__restResources[name] = resource;
      }
      return this.__restResources[name];
    },

    //  neccessary to register app instance as a service
    getInstance: function() {
      return this;
    },

    /**
     * getter for main form component
     * @return {qookery.component}
     */
    getForm: function() {
      return this.__formComponent;
    },

    /**
     * Initializes the application
     * @return {void}
     */
    init: function() {
      var registry = qookery.Qookery.getRegistry();
      // register application instance as a service
      registry.registerService("app", this);

      // setup selectbox data binding
      var libraryStore = new qx.data.store.Rest(
        this.getRestResource("selectBoxes"),
        "getLibraries"
      );

      var leftSelectBox = this.getForm()
        .getComponent("leftSelectBox")
        .getMainWidget();
      var controller1 = new qx.data.controller.List(
        null,
        leftSelectBox,
        "name"
      );
      libraryStore.bind("model", controller1, "model");

      var rightSelectBox = this.getForm()
        .getComponent("rightSelectBox")
        .getMainWidget();
      var controller2 = new qx.data.controller.List(
        null,
        rightSelectBox,
        "name"
      );
      libraryStore.bind("model", controller2, "model");

      // load selectboxes
      this.getRestResource("selectBoxes").getLibraries();

      // setup tree databinding
      var leftTreeStore = new qx.data.store.Rest(
        this.getRestResource("leftTree"),
        "getTreeData"
      );
      var leftTree = this.getForm().getComponent("leftTree").getMainWidget();
      leftTree.set({
        labelPath: "name",
        childProperty: "children",
        hideRoot: true,
        showTopLevelOpenCloseIcons: true
      });
      leftTreeStore.bind("model[0]", leftTree, "model");
      leftTree.getSelection().addListener(
        "change",
        function() {
          this.loadTable("left");
        },
        this
      );

      var rightTreeStore = new qx.data.store.Rest(
        this.getRestResource("rightTree"),
        "getTreeData"
      );
      var rightTree = this.getForm().getComponent("rightTree").getMainWidget();
      rightTree.set({
        labelPath: "name",
        childProperty: "children",
        hideRoot: true,
        showTopLevelOpenCloseIcons: true
      });
      rightTreeStore.bind("model[0]", rightTree, "model");
      rightTree.getSelection().addListener(
        "change",
        function() {
          this.loadTable("right");
        },
        this
      );

      // setup table databinding in main window
      var leftTableStore = new qx.data.store.Rest(
        this.getRestResource("leftTable"),
        "getTableData"
      );
      var leftTableComp = this.getForm().getComponent("leftTable");
      var leftTableModel = leftTableComp.getTableModel();
      leftTableStore.addListener(
        "changeModel",
        function(e) {
          leftTableModel.setData(e.getData()); // @todo skip marshalling
        },
        this
      );

      var rightTableStore = new qx.data.store.Rest(
        this.getRestResource("rightTable"),
        "getTableData"
      );
      var rightTableComp = this.getForm().getComponent("rightTable");
      var rightTableModel = rightTableComp.getTableModel();
      rightTableStore.addListener(
        "changeModel",
        function(e) {
          rightTableModel.setData(e.getData()); // @todo skip marshalling
        },
        this
      );
    },

    /**
     * Loads a tree with data from the backend
     * @param  {String} prefix The id of the component is prefix + "SelectBox"
     * @return {void}
     */
    loadTree: function(prefix, selectKey) {
      var selectBox = this.getForm()
        .getComponent(prefix + "SelectBox")
        .getMainWidget();
      var selection = selectBox.getModelSelection();
      if (selection.getLength() === 0) return;
      var libraryId = selection.getItem(0).getId();
      var appName = selection.getItem(0).getApplication();
      var type = selection.getItem(0).getType() == "user" ? "user" : "group";
      var treeResource = this.getRestResource(prefix + "Tree");
      var treeWidget = this.getForm()
        .getComponent(prefix + "Tree")
        .getMainWidget();
      treeResource.addListenerOnce(
        "getTreeDataSuccess",
        function(e) {
          if (selectKey) {
            console.log("Selecting folder with key " + selectKey);
            treeWidget.resetSelection();
            // traverse object tree
            (function recursiveSearch(qxDataArr) {
              qxDataArr.forEach(function(modelItem) {
                if (modelItem.getKey() == selectKey) {
                  treeWidget.getSelection().push(modelItem);
                  treeWidget.openNodeAndParents(modelItem);
                }
                if (modelItem.getChildren().getLength()) {
                  recursiveSearch(modelItem.getChildren());
                }
              });
            })(treeWidget.getModel().getChildren());
          }
        },
        this
      );
      treeResource.getTreeData({
        type: type,
        id: libraryId,
        application: appName
      });
    },

    /**
     * Given a prefix, returns information on the collection currently selected
     * in the tree component that the prefix refers to.
     * @param  {String} prefix "left|right"
     * @return {Ob ject} Map containint the keys application, libraryId, type, collectionKey
     */
    getCollectionInfo: function(prefix) {
      var librarySelection = this.getForm()
        .getComponent(prefix + "SelectBox")
        .getMainWidget()
        .getModelSelection();
      if (librarySelection.getLength() === 0) return null;
      var table = this.getForm().getComponent(prefix + "Table").getMainWidget();
      var treeSelection = this.getForm()
        .getComponent(prefix + "Tree")
        .getMainWidget()
        .getSelection();
      if (treeSelection.getLength() === 0) return null;
      return {
        application: librarySelection.getItem(0).getApplication(),
        id: librarySelection.getItem(0).getId(),
        type: librarySelection.getItem(0).getType() == "user"
          ? "user"
          : "group",
        collectionKey: treeSelection.getItem(0).getKey()
      };
    },

    /**
     * Loads a table with data from the backend
     * @param  {String} prefix [description]
     * @return void
     */
    loadTable: function(prefix) {
      var info = this.getCollectionInfo(prefix);
      if (info === null) return;
      this.getRestResource(prefix + "Table").getTableData(info);
    },

    /**
     * Starts the syncronization
     * @param  {String} source source prefix
     * @param  {String} target target prefix
     * @return {void}
     */
    sync: function(source, target) {
      var info = {
        source: this.getCollectionInfo(source),
        target: this.getCollectionInfo(target)
      };
      if (!info.source || !info.target) return;
      var params = {
        action: "start",
        sourceApplication: info.source.application,
        sourceType: info.source.type,
        sourceId: info.source.id,
        sourceCollectionKey: info.source.collectionKey,
        targetApplication: info.target.application,
        targetType: info.target.type,
        targetId: info.target.id,
        targetCollectionKey: info.target.collectionKey
      };
      var restResource = this.getRestResource("sync");
      var store = new qx.data.store.Rest(restResource, "sync");

      // reset store on error
      restResource.addListener("error", function() {
        store.dispose();
        store = new qx.data.store.Rest(restResource, "sync");
      });

      /*
        handles response from sync api call
       */
      var manualSyncResult = [];
      var that = this;
      function handler(e) {
        var data = e.getData();
        switch (data.getResponseAction()) {
          case "alert":
            return dialog.Dialog.alert(data.getResponseData());

          case "error":
            return dialog.Dialog.error("Error: " + data.getResponseData());

          case "confirm":
            dialog.Dialog
              .confirm(data.getResponseData())
              .promise()
              .then(function(result) {
                params.action = data.getAction();
                store.addListenerOnce("changeModel", handler);
                restResource.sync(params);
              });
            break;
          case "startManualSync":
            // check if we have results
            if (data.getResponseData().getLength() === 0) {
              dialog.Dialog.alert(
                "Nothing to compare: Collections empty or identical."
              );
              return;
            }

            var model = qx.data.marshal.Json.createModel(
              {
                items: null,
                index: null,
                mode: "merge",
                info: info,
                action: null
              },
              true
            );

            model.setItems(data.getResponseData());

            if (!this.__synopsisComponent) {
              qookery.contexts.Qookery.loadForm(
                "resource/bibsync/forms/synopsis.xml",
                that,
                {
                  model: model,
                  success: that.configureSynopis,
                  fail: function(e) {
                    console.error(e);
                  }
                }
              );
            } else {
              that.configureSynopis(this.__synopsisComponent, model);
            }
            return;
        }
      }
      store.addListenerOnce("changeModel", handler, this);
      restResource.sync(params);
    },

    __synopsisComponent: null,

    /**
     * Called when the form component has been loaded and parsed
     * @param  {qookery.IFormComponent}  component The form component
     * @param  {qx.Object} model  A qooxdoo object
     * @return {void}
     */
    configureSynopis: function(component, model) {
      this.__synopsisComponent = component;
      model.addListener(
        "changeBubble",
        function(e) {
          switch (e.getData().name) {
            case "mode":
            case "index":
              this.updateSynopsis();
              break;
          }
        },
        this
      );
      qookery.contexts.Qookery.openWindow(component);
      component.setModel(model);
      model.setIndex(0);
    },

    /**
     * Reduce a qooxdoo array containing qx objects with a "key" and a "value"
     * property to a javascript object with key and value pairs
     * @param  {qx.data.array} item qxArr
     * @return {Object} The native object
     */
    _deKeyValueize: function(qxArr) {
      var result = {};
      qxArr.forEach(function(item) {
        result[item.getKey()] = item.getValue();
      }, this);
      return result;
    },

    /**
     * Updates the synopsis window
     * @return {void}
     */
    updateSynopsis: function() {
      var component = this.__synopsisComponent;

      var index = component.getModel().getIndex();
      var mode = component.getModel().getMode();
      var item = component.getModel().getItems().getItem(index);

      var sourceItem = item.getItem(0);
      var targetItem = item.getItem(1);
      var keys = item.getItem(2);

      var sourceItemNative = this._deKeyValueize(sourceItem);
      var targetItemNative = this._deKeyValueize(targetItem);
      var mergedItemNative = [];

      keys.forEach(function(key) {
        var value;
        switch (mode) {
          case "source":
            value = sourceItemNative[key];
            break;
          case "target":
            value = targetItemNative[key];
            break;
          case "merge":
            value = sourceItemNative[key]
              ? sourceItemNative[key]
              : targetItemNative[key];
            break;
        }
        if (value !== undefined)
          mergedItemNative.push({ key: key, value: value });
      }, this);

      var mergedItem = qx.data.marshal.Json.createModel(mergedItemNative, true);

      //[sourceItemNative, targetItemNative, mergedItemNative ].forEach(console.dir);

      var action;
      if (mergedItem.getLength() === 0) {
        action = "remove";
      } else if (targetItem.getLength() === 0) {
        action = "create";
      } else {
        action = "update";
      }
      component.getModel().setAction(action);
      component.getComponent("sourceItem").getTableModel().setData(sourceItem);
      component.getComponent("targetItem").getTableModel().setData(targetItem);
      component.getComponent("mergedItem").getTableModel().setData(mergedItem);
    },

    saveAll: function() {
      this.save(true);
    },

    /**
     * Save merged items
     * @return {void}
     */
    save: function(all) {
      if (all === true) {
        var msg = "Start synchronization? This will irreversibly create, delete and overwrite entries in the target library.";
        dialog.Dialog.confirm(msg).promise()
        .then(
          function(yes) {
            if (yes) this.save(1);
          }.bind(this)
        );
        return;
      }

      var component = this.__synopsisComponent;
      var tableModel = component.getComponent("mergedItem").getTableModel();
      var model = component.getModel();
      var items = model.getItems();
      var action = model.getAction();
      var info = model.getInfo();
      var target = info.getTarget();

      // configure rest resource
      var rest = this.getRestResource("item");
      rest.addListenerOnce(
        "success",
        function() {
          items.remove(items.getItem(model.getIndex()));
          if (items.getLength()) {
            if (model.getIndex() == items.getLength()) {
              model.setIndex(items.getLength() - 1);
            }
            this.updateSynopsis();
            if (all) {
              this.save(1);
            }
          } else {
            component.close();
            this.loadTable("left");
            this.loadTable("right");
          }
        },
        this
      );

      var data = {};
      for (var i = 0; i < tableModel.getRowCount(); i++) {
        var rowData = tableModel.getRowData(i);
        data[rowData.getKey()] = rowData.getValue();
      }
      data.info = qx.util.Serializer.toJson(info);

      switch (action) {
        case "remove":
          if (all || confirm("Remove item from collection?")) {
            rest.removeCollectionItem(
              {
                application: target.getApplication(),
                type: target.getType(),
                id: target.getId(),
                collectionKey: target.getCollectionKey()
              },
              data
            );
          }
          break;

        case "create":
          if (all || confirm("Create new item in collection?")) {
            var serverAction = info.getTarget().getApplication() ==
              info.getSource().getApplication()
              ? "copyItem"
              : "createItem";
            rest.invoke(
              serverAction,
              {
                application: target.getApplication(),
                type: target.getType(),
                id: target.getId()
              },
              data
            );
          }
          break;

        case "update":
          if (all || confirm("Really update item?")) {
            rest.invoke(
              "updateItem",
              {
                application: target.getApplication(),
                type: target.getType(),
                id: target.getId()
              },
              data
            );
          }
          break;
      }
    },

    /**
     * Copies a folder and its contents as a subfolder of the currently selected
     * target folder
     * @param  {String} source [description]
     * @param  {String} target [description]
     * @return {void}          [description]
     */
    copyFolder: function(source, target, confirmed) {
      if (!confirmed) {
        var msg =
          "This will copy the folder and its content selected in the left " +
          "pane into the folder selected in the right pane. Continue?";
        dialog.Dialog.confirm(msg).promise().then(
          function(yes) {
            if( yes ) this.copyFolder(source, target, true);
          }.bind(this)
        );
        return;
      }
      var info = {
        source: this.getCollectionInfo(source),
        target: this.getCollectionInfo(target)
      };
      if (!info.source || !info.target) return;
      this.callServerMethod("bibsync.copy", info).then(
        function() {
          this.loadTree(target, info.target.collectionKey);
        }.bind(this)
      );
    },

    /**
     * Run the current test
     * @return {[type]} [description]
     */
    runTest: function() {
      this.getRestResource("test").test();
    }
  }
});
