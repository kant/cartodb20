/**
 *  entry point for table
 */


$(function() {


  var Table = cdb.core.View.extend({

    el: document.body,

    events: {
      'keypress': 'keyPress',
      'keyup': 'keyUp'
    },

    initialize: function() {
      this.user = new cdb.admin.User(this.options.user_data);

      this._initModels();
      this._initViews();

      // init data
      // table change will raise the map and columns fetch
      this.table.fetch();

    },

    _initModels: function() {
      var self = this;
      this.table = new cdb.admin.CartoDBTableMetadata({
        id: this.options.table_id
      });
      this.columns = this.table.data();
      this.map = new cdb.admin.Map();
      this.infowindow = new cdb.geo.ui.InfowindowModel({ 
        template_name: 'table/views/infowindow_light'
      });
      this.sqlView = new cdb.admin.SQLViewData();


      //TODO: load this from an initial data file or d
      // something like this
      var layers = [
        'http://tile.stamen.com/toner/{z}/{x}/{y}.png',
        'http://a.tiles.mapbox.com/v3/mapbox.mapbox-light/{z}/{x}/{y}.png',
        //'http://tile.stamen.com/terrain/{z}/{x}/{y}.png',
        //'http://tile.stamen.com/watercolor/{z}/{x}/{y}.png',
        'http://a.tiles.mapbox.com/v3/mapbox.mapbox-streets/{z}/{x}/{y}.png'
      ];

      this.baseLayers = new cdb.geo.Layers(
        _(layers).map(function(m) {
          return new cdb.admin.TileLayer({ urlTemplate: m });
        })
      );

      // fetch or create map id
      this.map.relatedTo(this.table);

      this.map.bind('change:dataLayer', _.once(function() {

        // cache the value to access it in all the view
        self.dataLayer = self.map.get('dataLayer');

        // when the layer query changes the table should change
        self.dataLayer.bind('change:query', function() {
          var sql = this.get('query');
          if(sql) {
            self.sqlView.setSQL(sql);
            self.table.useSQLView(self.sqlView);
            // if there is some error, rollback the query
            self.sqlView.fetch()
          } else {
            self.table.useSQLView(null);
          }
        });

        self.sqlView.bind('error', function() {
          self.dataLayer.save({query: null}, {silent: true});
        })

        // trigger the event to ping all views
        self.dataLayer.trigger('change:query');

        var infowindowData = self.dataLayer.get('infowindow');
        if(infowindowData) {
          self.infowindow.set(infowindowData);
        } else {
          _(self.table.get('schema')).each(function(v) {
            self.infowindow.addField(v[0]);
          });
        }

        self.infowindow.bind('change:fields change:template_name', function() {
          // call with silent so the layer is no realoded
          // if some view needs to be changed when infowindow is changed it should be 
          // subscribed to infowindow model not to dataLayer 
          // (which is only a data container for infowindow)
          self.dataLayer.save({ infowindow: self.infowindow.toJSON() }, { silent: true });
        });


      }));

    },

    _initViews: function() {
      var self = this;

      this.header = new cdb.admin.Header({
        el: this.$('header'),
        model: this.table,
        user: this.user
      });
      this.addView(this.header);


      this.tabs = new cdb.admin.Tabs({
        el: this.$('nav')
      });
      this.addView(this.tabs);

      this.workView = new cdb.ui.common.TabPane({
        el: this.$('.panes')
      });

      this.addView(this.workView);

      this.tableTab = new cdb.admin.TableTab({
        model: this.table
      });

      this.mapTab = new cdb.admin.MapTab({
        model: this.map,
        baseLayers: this.baseLayers,
        table: this.table,
        infowindow: this.infowindow
      });

      this.globalError = new cdb.admin.GlobalError({
        el: $('.globalerror')
      });
      this.table.bind('notice', this.globalError.showError, this.globalError);
      this.addView(this.globalError);

      this.menu = new cdb.admin.RightMenu({});
      this.$el.append(this.menu.render().el);
      this.menu.hide();
      this.addView(this.menu);

      this.map.bind('change:dataLayer', _.once(function() {

        self.header.setDataLayer(self.dataLayer);

        self.table.bind('change:name', function() {
          self.dataLayer.set({ table_name: self.table.get('name') });
          self.dataLayer.save();
        });

        self.dataLayer.set({
          table_name: self.table.get('name'),
          user_name: self.user.get("username"),
          sql: sql,
          extra_params: {
            map_key: self.user.get('api_key')
          },
          sql_api_domain: cdb.config.get('sql_api_domain'),
          sql_api_endpoint: cdb.config.get('sql_api_endpoint'),
          sql_api_port: cdb.config.get('sql_api_port'),
          tiler_domain: cdb.config.get('tiler_domain'),
          tiler_port: cdb.config.get('tiler_port')
        });

        self.dataLayer.save();

        // set api key when we have api key and the data layer loaded
        var sql = self.table.isInSQLView() ?
                      self.table.data().getSQL() :
                      undefined;


        // lateral menu modules
        var sql = new cdb.admin.mod.SQL({
          model: self.dataLayer,
          sqlView: self.sqlView
        });

        var carto = new cdb.admin.mod.Carto({
          model: self.dataLayer,
          table: self.table
        });

        var infowindow = new cdb.admin.mod.InfoWindow({
          table: self.table,
          model: self.infowindow
        });
        self.menu.addModule(sql.render(), ['table', 'map']);
        self.menu.addModule(carto.render(), 'map');
        self.menu.addModule(infowindow.render(), 'map');

        var addRow = self.menu.addToolButton('add_row', 'table');
        var addColumn = self.menu.addToolButton('add_column', 'table');
        addColumn.bind('click', function() {
            new cdb.admin.NewColumnDialog({
              table: self.table
            }).appendToBody().open();
        });
        addRow.bind('click', function() {
          self.table.data().addRow({ at: 0});
        });

        
        // TODO: replicate for all the .panel_content-s
        // self.$(".panel_content.nano").nanoScroller({
        //   alwaysVisible: true
        // }).bind("scrollend scroll scrolltop enabled disabled", function(e){
        //   var $nano = $(e.currentTarget);

        //   $nano.addClass(e.type);

        //   if (e.type == "enabled") {
        //     $nano.removeClass("disabled");
        //   } else if (e.type == "disabled") {
        //     $nano.removeClass("enabled");
        //   }

        //   if (e.type == "scrolltop") {
        //     $nano.removeClass("scrollend");
        //   } else if (e.type == "scrollend") {
        //     $nano.removeClass("scrolltop");
        //   }
        // });

      }));

      this.workView.addTab('table', this.tableTab.render());
      this.workView.addTab('map', this.mapTab.render());
      this.workView.bind('tabEnabled:map', this.mapTab.enableMap, this.mapTab);

      this.workView.bind('tabEnabled', this.tabs.activate);
      this.workView.active('table');

      // global click
      enableClickOut(this.$el);

      // On resize window...
      $(window).bind("resize", this._onResize);

    },

    // Close all dialogs in window resize
    _onResize: function(e) {
      cdb.god.trigger("closeDialogs");
    },

    keyUp: function(e) {
    },

    keyPress: function(e) {
      /*if(e.which == 19) {
        this.menu.show();
        this.menu.active('sql_mod');
        e.preventDefault();
        return false;
      }*/
    }

  });

    cdb._test = cdb._test || {};
    cdb._test.Table = Table;

    var TableRouter = Backbone.Router.extend({

        initialize: function(table) {
          var self = this;
          this.table = table;
          /*
          this.table.table.bind('change:dataSource', function() {
            if(this.isInSQLView()) {
              var sql = this.data().getSQL();
              if(!this.alterTableData(sql)) {
                self.navigate('table/' + encodeURIComponent(sql));
              }
            } else {
              self.navigate('table');
            }
          });
          */
        },

        routes: {
            '': 'index',
            'table': 'index',
            'table/:sql': 'table_sql',
            'map': 'map'
        },

        index: function() {
          this.table.workView.active('table');
          this.table.menu.showTools('table');
        },

        table_sql: function(sql) {
          this.index();
          if(!this.table.table.alterTableData(sql)) {
            this.table.sqlView.setSQL(decodeURIComponent(sql));
            this.table.table.useSQLView(this.table.sqlView);
          }
        },

        map: function() {
          this.table.workView.active('map');
          this.table.menu.showTools('map');
        }

    });

    cdb.init(function() {
      cdb.config.set(config);
      cdb.templates.namespace = 'cartodb/';
      var table = new Table({
        table_id: table_id,
        user_data: user_data
      });
      var router = new TableRouter(table);
      // expose to debug
      window.table = table;
      Backbone.history.start();
    });

});