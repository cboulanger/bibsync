/**
 *
 * @asset(bibsync/*)
 * @asset(qx/decoration/Modern/arrows-combined.png)
 * @asset(qx/icon/Tango/22/places/folder-open.png)
 * @asset(qx/icon/Tango/22/places/folder.png)
 */
qx.Class.define("bibsync.Application", {
  extend: qx.application.Standalone,

  members: {

    // simple properties
    __restResources: [],
    __formComponent: null,

    // entry point
    main: function() {

      this.base(arguments);

      // Enable logging in debug variant
      if (qx.core.Environment.get("qx.debug")) {
        // support native logging capabilities, e.g. Firebug for Firefox
        qx.log.appender.Native;
      }

      this.setupUI();

      // make sure the image resources are used.
      qx.ui.tree.VirtualTree;
      qx.ui.form.SelectBox;
    },

    // create main form component, calls this.init() when done.
    setupUI: function() {
      // render main layout
      qookery.contexts.Qookery.loadResource("bibsync/forms/application.xml", this, function(xmlSource) {
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

          // initialize if succesful
          this.init();

        } catch (e) {
          this.error("Error parsing application root form", e);
        } finally {
          parser.dispose();
        }
      });
    },

    // setup rest resource
    getRestResource: function(name) {
      if (!this.__restResources[name]) {
        var resource = new qx.io.rest.Resource({
          getLibraries: {
            method: "GET",
            url: "/sync/libraries"
          },
          getTreeData: {
            method: "GET",
            url: "/{application}/{type}/{id}/collections/tree"
          },
          getTableData: {
            method: "GET",
            url: "/{application}/{type}/{id}/collection/{collectionKey}/items"
          }
        });
        resource.addListener("error",function(e){
          qx.core.Init.getApplication().getRoot().setEnabled(true);
          alert(e.getData());
        },this);
        resource.configureRequest(function(){
          qx.core.Init.getApplication().getRoot().setEnabled(false);
        },this);
        resource.addListener("success",function(e){
          qx.core.Init.getApplication().getRoot().setEnabled(true);
        },this);
        this.__restResources[name] = resource;
      }
      return this.__restResources[name];
    },

    //  neccessary to register app instance as a service
    getInstance: function() {
      return this;
    },

    // getter for main form component
    getForm: function() {
      return this.__formComponent;
    },

    // initialize the application
    init: function() {
      var registry = qookery.Qookery.getRegistry();
      // register application instance as a service
      registry.registerService("app", this);

      // setup selectbox data binding
      var libraryStore = new qx.data.store.Rest(this.getRestResource("selectBoxes"), "getLibraries");

      var leftSelectBox = this.getForm().getComponent("leftSelectBox").getMainWidget();
      var controller1 = new qx.data.controller.List(null, leftSelectBox, "name");
      libraryStore.bind("model", controller1, "model");

      var rightSelectBox = this.getForm().getComponent("rightSelectBox").getMainWidget();
      var controller2 = new qx.data.controller.List(null, rightSelectBox, "name");
      libraryStore.bind("model", controller2, "model");

      // load selectboxes
      this.getRestResource("selectBoxes").getLibraries();

      // setup tree databinding
      var leftTreeStore = new qx.data.store.Rest(this.getRestResource("leftTree"), "getTreeData");
      var leftTree = this.getForm().getComponent("leftTree").getMainWidget();
      leftTree.set({
        labelPath: "name",
        childProperty: "children",
        hideRoot: true,
        showTopLevelOpenCloseIcons : true
      });
      leftTreeStore.bind("model[0]", leftTree, "model");

      var rightTreeStore = new qx.data.store.Rest(this.getRestResource("rightTree"), "getTreeData");
      var rightTree = this.getForm().getComponent("rightTree").getMainWidget();
      rightTree.set({
        labelPath: "name",
        childProperty: "children",
        hideRoot: true,
        showTopLevelOpenCloseIcons : true
      });
      rightTreeStore.bind("model[0]", rightTree, "model");

      // setup table databinding
      var leftTableStore = new qx.data.store.Rest(this.getRestResource("leftTable"), "getTableData");
      var leftTableComp = this.getForm().getComponent("leftTable");
      var leftTableModel = leftTableComp.getTableModel();
      leftTableStore.addListener("changeModel", function(e) {
        leftTableModel.setData(e.getData()); // @todo skip marshalling
      }, this);

      var rightTableStore = new qx.data.store.Rest(this.getRestResource("rightTable"), "getTableData");
      var rightTableComp = this.getForm().getComponent("rightTable");
      var rightTableModel = rightTableComp.getTableModel();
      rightTableStore.addListener("changeModel", function(e) {
        rightTableModel.setData(e.getData()); // @todo skip marshalling
      }, this);

    },

    loadTree: function(prefix) {
      var selection = this.getForm().getComponent(prefix + "SelectBox").getMainWidget().getModelSelection();
      if (selection.getLength() === 0) return;
      var libraryId = selection.getItem(0).getId();
      var appName   = selection.getItem(0).getApplication();
      var type      = selection.getItem(0).getType() == "user" ? "user" : "group";
      this.getRestResource(prefix + "Tree").getTreeData({
        type: type,
        id: libraryId,
        application: appName
      });

    },

    loadTable: function(prefix) {
      var librarySelection = this.getForm().getComponent(prefix + "SelectBox").getMainWidget().getModelSelection();
      if( librarySelection.getLength() === 0) return;
      var appName = librarySelection.getItem(0).getApplication();
      var libId   = librarySelection.getItem(0).getId();
      var type    = librarySelection.getItem(0).getType() == "user" ? "user" : "group";

      var treeSelection = this.getForm().getComponent(prefix + "Tree").getMainWidget().getSelection();
      var table = this.getForm().getComponent(prefix + "Table").getMainWidget();
      if (treeSelection.getLength() === 0) return;
      var collKey = treeSelection.getItem(0).getKey();

      this.getRestResource(prefix + "Table").getTableData({
        type  : type,
        id    : libId,
        collectionKey : collKey,
        application   : appName
      });
    }
  }
});
