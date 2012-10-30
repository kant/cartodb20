describe('UserMenu', function() {
  var view;
  beforeEach(function() {
    view = new cdb.admin.DropdownMenu({
      speedIn: 250
    });
  });

  it("should open at position x, y", function() {
    var shown = false;
    this.clock = sinon.useFakeTimers();

    $.when(view.openAt(11, 12)).done(function() {
        shown = true;
    });

    this.clock.tick(view.options.speedIn + 100);


    waitsFor(function() {
      return shown;
    }, "should be shown", view.options.speedIn + 3000);

    expect(view.$el.css('opacity')).toEqual('1');
    expect(view.$el.css('top')).toEqual('12px');
    expect(view.$el.css('left')).toEqual('11px');

    this.clock.restore();
  });
});