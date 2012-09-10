
/*
 * extend infowindow to serialize only the data we need
 */
_.extend(cdb.geo.ui.InfowindowModel.prototype, {
  toJSON: function() {
    return {
      fields: _.clone(this.attributes.fields),
      template_name: this.attributes.template_name
    };
  }
});

/**
 * extend plain layer for data serialization
 */
cdb.admin.PlainLayer= cdb.geo.PlainLayer.extend({

  parse: function(data) {
    var c = {};
    _.extend(c, data.options, {
      id: data.id,
      type: 'Plain'
    });
    return c;
  },

  toJSON: function() {
    var c = _.clone(this.attributes);

    var d = {
      kind:  'background',
      options: c
    };

    if(c.id !== undefined) {
      d.id = c.id;
    }
    return d;
  }

});

/**
 * extend tiled layer to adapt serialization
 */
cdb.admin.TileLayer = cdb.geo.TileLayer.extend({

  parse: function(data) {
    var c = {};
    _.extend(c, data.options, {
      id: data.id,
      type: 'Tiled'
    });
    return c;
  },

  toJSON: function() {
    var c = _.clone(this.attributes);

    var d = {
      kind:  'tiled',
      options: c
    };

    if(c.id !== undefined) {
      d.id = c.id;
    }
    return d;
  }

});

var attrHistory = function(model, attr) {

    model.MAX_HISTORY = 5;

    // variables needed to keep history state
    var attrHistory =  attr + '_history';
    var attrHistoryPos = attr + '_history_position'
    model[attrHistoryPos] = 0;

    // save history when attr changes
    var save = model['save' + attrHistory] = function(m, attrVal) {
      var h = model.attributes[attrHistory];
      h.push(attrVal);
      if(h.length > model.MAX_HISTORY)  {
        h.shift();
      }
      model.trigger('change:' + attrHistory, model, model.attributes[attrHistory]);
    }

    // to go foward and backward in history
    function moveHistory(d) {
      var h = model[attrHistoryPos] + d;
      // clamp
      model[attrHistoryPos] = Math.min(Math.max(0, h), model.attributes[attrHistory].length - 1);
      model.unbind('change:' + attr, save, model);
      var a = {};
      a[attr] =  model.attributes[attrHistory][model[attrHistoryPos]];
      model.set(a);
      model.bind('change:' + attr, save, model);
    }
    model['move' + attr + 'History'] = moveHistory;

    // bind changes
    model.bind('change:' + attr, save, model);
    model.bind('change:' + attrHistory, function() {
      model[attrHistoryPos] = model.get(attrHistory).length - 1;
    }, model);

    // create history list in the model if it does not exist
    if(!model.has(attrHistory)) {
      var a = {};
      a[attrHistory] = [];
      model.set(a, { silent: true });
    }
}

cdb.admin.CartoDBLayer = cdb.geo.CartoDBLayer.extend({

  MAX_HISTORY: 5,

  initialize: function() {
    attrHistory(this, 'tile_style');
    attrHistory(this, 'query');
  },

  redoStyle: function() {
    this.movetile_styleHistory(1);
  },

  undoStyle: function() {
    this.movetile_styleHistory(-1);
  },
  
  redoQuery: function() {
    this.movequeryHistory(1);
  },

  undoQuery: function() {
    this.movequeryHistory(-1);
  },

  toJSON: function() {
    var c = _.clone(this.attributes);
    // remove api key
    if(c.extra_params) {
      c.extra_params = _.clone(this.attributes.extra_params);
      if(c.extra_params.api_key) {
        delete c.extra_params.api_key;
      }
      if(c.extra_params.map_key) {
        delete c.extra_params.map_key;
      }
    }

    var infowindow = c.infowindow;
    delete c.infowindow;
    var d = {
      kind: 'carto',
      options: c,
      infowindow: infowindow
    };
    if(c.id !== undefined) {
      d.id = c.id;
    }
    return d;
  },

  parse: function(data) {
    var c = {};

    // if api_key exist alread, set in params to not lose it
    if(data.options.extra_params && this.attributes && this.attributes.extra_params) {
      data.options.extra_params.map_key = this.attributes.extra_params.map_key;
    }

    _.extend(c, data.options, {
      id: data.id,
      type: 'CartoDB',
      infowindow: data.infowindow
    });

    return c;
  }


});

cdb.admin.Layers = cdb.geo.Layers.extend({

  // the model class works here like a factory
  // depending of the kind of layer creates a
  // type of layer or other
  model: function(attrs, options) {
    var typeClass = {
      'Tiled': cdb.admin.TileLayer,
      'CartoDB': cdb.admin.CartoDBLayer,
      'Plain': cdb.admin.PlainLayer
    };
    var typeMap = {
      'Layer::Tiled': 'Tiled',
      'Layer::Carto': 'CartoDB',
      'Layer::Background': 'Plain',
      'tiled': 'Tiled',
      'carto': 'CartoDB',
      'background': 'Plain'
    };

    return new typeClass[typeMap[attrs.kind]](attrs, options);
  },

  url: function() {
    return '/api/v1/maps/' +  this.map.id + '/layers';
  },

  parse: function(data) {
    return data.layers;
  },

  /**
   * on reset order the layers so tiled layer are under cartodb layers
   */
  reset: function(models, options) {
    var sortOrder = {
      'Tiled': 0,
      'CartoDB': 1,
      'tiled': 0,
      'carto': 1
    };
    var sortModels = function(a, b) {
      return sortOrder[a.get('type')] - sortOrder[b.get('type')];
    };
    var sortRaw = function(a, b) {
      return sortOrder[a.kind] - sortOrder[b.kind];
    };

    if(_.size(models)) {
      // if is not a model use raw sort
      _(models).sort(models[0].get === undefined ? sortRaw : sortModels);
    }

    Backbone.Collection.prototype.reset.call(this, models, options);
  }


});

/**
 * this is a specialization of generic map prepared to hold two layers:
 *  - a base layer
 *  - a data layer which contains the table data
 *
 * cartodb only supports one data layer per map so this will change when
 * that changes
 */

cdb.admin.Map = cdb.geo.Map.extend({

  urlRoot: '/api/v1/maps',

  initialize: function() {
    this.constructor.__super__.initialize.apply(this);
    this.delayedSave = _.debounce(this.save, 1000);
    //this.autoSave();
    this.bind('change:id', this._fetchLayers, this);
    this.layers = new cdb.admin.Layers();
    this.layers.map = this;
    this.layers.bind('reset', this._layersChanged, this);
    this.layers.bind('add', this._layersChanged, this);
  },

  _layersChanged: function() {
    if(this.layers.size() >= 2) {
      this.set({ dataLayer: this.layers.at(1) });
    }
  },

  // fetch related layers
  _fetchLayers: function() {
    this.layers.fetch();
  },

  /**
   * link to a table
   */
  relatedTo: function(table) {
    this.table = table;
    this.table.bind('change:map_id', this._fetchOrCreate, this);
  },

  parse: function(data) {
    data.bounding_box_ne = JSON.parse(data.bounding_box_ne);
    data.bounding_box_sw = JSON.parse(data.bounding_box_sw);
    data.center = JSON.parse(data.center);
    return data;
  },

  _fetchOrCreate: function() {
    var self = this;
    var map_id = this.table.get('map_id');
    if(!map_id) {
      this.create();
    } else {
      this.set({ id: map_id });
      this.fetch({
        error: function() {
          cdb.log.info("creating map for table");
          self.create();
        }
      });
    }
  },

  /**
   * the first version of cartodb contains one single layer
   * per table with information.
   */
  addDataLayer: function(lyr) {
    this.addLayer(lyr);
    this.set({ dataLayer: lyr });
  },

  /**
   * create a new map. this is a helper to use from javascript command line
   */
  create: function() {
    this.unset('id');
    this.set({ table_id: this.table.id });
    this.save();
  },

  /**
   * enable save map each time the viewport changes
   * not working
   */
  autoSave: function() {
    this.bind('change:center', this.delayedSave);
    this.bind('change:zoom', this.delayedSave);
  },

  toJSON: function() {
    var c = _.clone(this.attributes);
    // data layer is a helper to work in local
    delete c.dataLayer;
    return c;
  }

});