cdb.admin.mod.HeatmapWizard = cdb.admin.mod.SimpleWizard.extend({

  MODULES: ["infowindow"],

  error_msg: {
    NO_CONTENT_MSG: _t('There are no numeric columns on your table to make a heatmap visualization.<br/>If you have numbers on your table, but you don\'t see them here is likely they are set as String.')
  },

  initialize: function() {
    this.options.form = cdb.admin.forms.heatmap;
    cdb.admin.mod.SimpleWizard.prototype.initialize.call(this);

    this.type = 'heatmap';
  },

  isValid: function() {
    return this._getNumberColumns().length > 0;
  },

  render: function() {
    if(this.isValid()) {
      cdb.admin.mod.SimpleWizard.prototype.render.call(this);
    } else {
      this.renderError(this.error_msg.NO_CONTENT_MSG);
    }
    return this;
  }

});


