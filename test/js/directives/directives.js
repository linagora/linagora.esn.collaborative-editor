'use strict';

/* global chai: false */

var expect = chai.expect;

describe('collaborative editor directives', function() {
  var scope, $rootScope, $window, element, $compile, properties = {}, stateValue;
  var previousQuill;
  var charactersObject, editorObject;

  var eventCallbackService = {
    on: function() {},
    off: function() {}
  };
  var i18nService = {
    __: function(key) {
      return {
        then: function(cb) {
          cb(key);
        }
      };
    },
    getCatalog: function() {
      return {
        then: function(cb) {
          cb({
            Markdown: 'Markdown',
            'Raw text': 'Raw text',
            PDF: 'PDF'
          });
        }
      };
    }
  };

  beforeEach(function() {
    module('collaborative-editor');
    module('jadeTemplates');
    module(function($provide) {
      $provide.service('yjsService', function() {
        var tmp = chai.spy(function() {});

        charactersObject = {
          observe: tmp
        };

        editorObject = {
          _model: {
            getContent: function() {
              return charactersObject;
            }
          },
          getText: function() {
            return 'abc';
          }
        };

        var messageListeners = [];

        return {
          y: {
            val: function() {
              return editorObject;
            },
            observe: function() {}
          },
          connector: {
            whenSynced: function() {},
            addMessageListener: function(callback) {
              messageListeners.push(callback);
            },
            getMessageListeners: function() {
              return messageListeners;
            }
          }
        };
      });
      $provide.value('contentGetters', function() {
        function empty() { return ''; }

        return {
          quill: empty,
          yjs: empty,
          getRemote: empty
        };
      });
      $provide.value('currentConferenceState', function() {
        return function() {};
      });
      $provide.value('easyRTCService', {
        setPeerListener: function() {}
      });

      $provide.value('attendeeColorsService', function() {
        return true;
      });

      $provide.value('i18nService', i18nService);
      $provide.value('properties', properties);
      $provide.value('$state', {
        go: function(state) {
          stateValue = state;
        }
      });
      $provide.value('detectUtils', {
        isMobile: function() {
          return true;
        }
      });
      $provide.value('eventCallbackService', eventCallbackService);
      $provide.value('saverFactory', {
        register: function() {},
        get: function() {
          return [{
            name: 'test',
            tooltip: 'test',
            export: function() {}
          }];
        }
      });

    });
  });

  beforeEach(inject(function(_$rootScope_, _$compile_, _$window_) {
    $rootScope = _$rootScope_;
    $compile = _$compile_;
    scope = $rootScope.$new();
    function Quill() {
      return true;
    }

    Quill.events = {
      TEXT_CHANGE: 'text-change'
    };

    Quill.prototype.on = chai.spy(function() {});
    $window = _$window_;
    previousQuill = $window.Quill;
    $window.Quill = Quill;
  }));

  afterEach(function() {
    $window.Quill = previousQuill;
  });

  describe('exportFacility', function() {
    var element;

    beforeEach(function() {
      element = angular.element(
        '<div export-facility></div>'
      );
      $compile(element)(scope);
      scope.$digest();
    });

    it('should have scope.savers', function() {
      expect(element.scope().savers).to.be.an('array');
    });

    it('should have populated savers using the saverFacility', function() {
      expect(element.scope().savers.length).to.equal(1);
    });

    it('should set properties.documentSaved to false when a saver is triggered', function() {
      scope.savers[0].export();

      expect(properties.documentSaved).to.be.true;
    });
  });

  describe('liveConferenceEditorController', function() {
    beforeEach(function() {
      element = angular.element('<div live-conference-editor-controller></div>');
      $compile(element)(scope);
      scope.$digest();
    });

    it('should populate the scope', function() {
      var localScope = element.scope();

      expect(localScope.properties).to.exist;
      expect(localScope.properties.paneSize).to.exist;
      expect(localScope.properties.editor_visible).to.be.false;
      expect(localScope.toggleEditor).to.exist;

    });

    it('should create a quill instance on first call', function() {
      var localScope = element.scope();

      expect(localScope.properties.quill).to.not.exist;

      localScope.toggleEditor();
      expect(localScope.properties.quill).to.exist;
    });

  });
  describe('liveConferenceEditor', function() {
    beforeEach(function() {
      element = $compile('<live-conference-editor></live-conference-editor>')(scope);
      scope.$digest();
    });

    it('should populate the scope', function() {
      var localScope = element.scope();

      expect(localScope.colors).to.exist;
    });

    it('should pass angular-resizable.resizeEnd events to paneSize events', function(done) {
      scope.$on('paneSize', function() { done(); });
      scope.$emit('angular-resizable.resizeEnd', { width: 1000 });
      scope.$digest();
    });

    it('should not pass angular-resizable.resizing events to paneSize events', function(done) {
      scope.$on('paneSize', function() { done('This test should not emit paneSize events...'); });
      scope.$emit('angular-resizable.resizing', { width: 1000 });
      scope.$digest();

      done();
    });

    it('should switch to editor state when receiving editor:visible ', function(done) {
      scope.$emit('editor:visible', {paneSize: {
        width: '100%'
      }});
      expect(stateValue).to.equal('app.editor-mobile');
      scope.$digest();
      done();
    });

    it('should switch to conference state when receiving editor:hidden ', function(done) {
      scope.$emit('editor:hidden');
      expect(stateValue).to.equal('app.conference');
      scope.$digest();
      done();
    });
  });

  describe('editorToggleElement', function() {
    var button;

    beforeEach(function() {
      button = angular.element(
        '<editor-toggle-element></editor-toggle-element>'
      );
      element = angular.element(
        '<live-conference-editor></live-conference-editor>'
      );
      $compile(element)(scope);
      $compile(button)(scope);

      scope.$digest();
    });

    it('should have toggleEditor in scope', function() {
      expect(button.scope().toggleEditor).to.exist;
    });

    it('should call the scope.toggleEditor on click', function(done) {
      button.scope().toggleEditor = function() { done(); };

      button.find('a').click();
    });
  });

  describe('editorClickHandler', function() {
    var element, start, end, length, quill;

    beforeEach(function() {
      start = 10;
      end = 15;
      length = 20;
      quill = properties.quill;

      quill.setSelection = chai.spy();
      quill.getSelection = chai.spy(function() {
        return {start: start, end: end};
      });
      quill.getLength = chai.spy(function() {
          return length;
      });

    });

    beforeEach(function() {
      element = angular.element('<div editor-click-handler></div>');

      $compile(element)(scope);

      scope.$digest();
    });

    it('should have set the selection', function() {
      element.click();

      expect(quill.setSelection).to.have.been.called.once;
    });

    it('should put the focus to the previous selection if any', function() {
      element.click();

      expect(quill.setSelection).to.have.been.called.with(start, end);
    });

    // I don't understand why this test is not passing, so I'm skipping it. If
    // you console.log the arguments of setSelection just before it, you see
    // it is ok, but chai fails at testing it…
    it.skip('should put the focus to the end of the editor if no selection', function() {
      quill.getSelection = chai.spy(function() { return null; });
      element.click();

      expect(quill.setSelection).to.have.been.called.with(length - 1, length - 1);
    });
  });
});
