'use strict';

/* global chai: false */

var expect = chai.expect;

describe('Collaborative editor services', function() {
  var scope, $rootScope, $compile;
  var eventCallbackService = {}, onCallback = {}, quillOnCallback, quillOnEvent;
  var charactersCb, editorObject, yCb;

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
            'PDF': 'PDF'
          });
        }
      };
    }
  };

  beforeEach(function () {
    module('collaborative-editor');
    module('jadeTemplates');
    module(function ($provide) {
      $provide.service('yjsService', function () {
        editorObject = {
          _model: {
            getContent: function() {
              return {
                observe: function(cb) {
                  charactersCb = cb;
                }
              };
            }
          },
          getText: function() {
            return 'abc';
          }
        };

        var messageListeners = [];
        return  {
          y: {
            val: function() {
              return editorObject;
            },
            observe: function(cb) {
              yCb = cb;
            }
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
      $provide.value('currentConferenceState', function (){
        return function() {};
      });

      $provide.value('attendeeColorsService', function () {
        return true;
      });

      $provide.value('eventCallbackService', eventCallbackService);
      $provide.value('i18nService', i18nService);
      $provide.value('easyRTCService', {
        setPeerListener: function() {}
      });
      $provide.value('contentGetters', {});
      function Quill() {
        return true;
      }
      Quill.events = {
        TEXT_CHANGE: 'text-change'
      };
      Quill.prototype.on = chai.spy(function(event, cb) {
        quillOnEvent = event;
        quillOnCallback = cb;
      });
      $provide.value('$window', {
        Quill: Quill
      });
      eventCallbackService.on = chai.spy(function(event, cb) { onCallback[event] = cb; });
      eventCallbackService.off = chai.spy(function() {});
    });
  });

  beforeEach(inject(function (_$rootScope_, _$compile_) {
    $rootScope = _$rootScope_;
    $compile = _$compile_;
    scope = $rootScope.$new();
  }));

  describe('saverFactory', function() {
    var saverFactory;

    beforeEach(inject(function(_saverFactory_) {
      saverFactory = _saverFactory_;
    }));

    it('should have a register facility', function() {
      expect(saverFactory.register).to.exist;
    });

    it('should have an unregister facility', function() {
      expect(saverFactory.unregister).to.exist;
    });

    it('should have a get facility', function() {
      expect(saverFactory.get).to.exist;
    });

    it('should have working register, unregister and get', function() {
      var initialLength;
      expect(saverFactory.get()).to.be.an('array');

      initialLength = saverFactory.get().length;

      saverFactory.register('Test', 'This is a test', function() {});
      expect(saverFactory.get().length).to.equal(++initialLength);

      saverFactory.unregister('Test');
      expect(saverFactory.get().length).to.equal(--initialLength);
    });
  });

  describe('properties', function() {
    var propertiesA, propertiesB;
    beforeEach(inject(function(_properties_) {
      propertiesA = _properties_;
      propertiesB = _properties_;
    }));

    it('should be able to accept new elements', function() {
      propertiesA.foo = 'bar';
      expect(propertiesB.foo).to.equal('bar');
    });
  });

  describe('editorFactory', function() {
    var editorFactory;
    beforeEach(inject(function(_editorFactory_, $window) {
      editorFactory = _editorFactory_;
      $window.Quill = function() {
        this.spy = chai.spy();
        this.spy();
      };
    }));

    it('should initialize an editor once', function() {
      var firstQuill = editorFactory.getEditor(),
        secondQuill = editorFactory.getEditor();

      expect(secondQuill).to.equal(firstQuill);
      expect(firstQuill.spy).to.have.been.called.once();
    });
  });

  describe('attachInformationProviderService', function() {
    var attachInfoProviderService, editor;

    beforeEach(inject(function(_attachInformationProviderService_, _editorFactory_, _$window_) {
      attachInfoProviderService = _attachInformationProviderService_;

      _$window_.Quill = function() {
        this.attachProvider = chai.spy();
        return this;
      };

      editor = _editorFactory_.getEditor();

    }));

    it('should attach a name provider and a color provider to the editor', function() {
      attachInfoProviderService(editor);
      expect(editor.attachProvider).to.have.been.called.with('nameProvider')
        .and.to.have.been.called.with('colorProvider');
    });
  });

  describe('bindEditorService', function() {
    var bindEditorService, connector, y, $window;
    beforeEach(inject(function(_bindEditorService_, _$window_) {
      var whenSyncedCallback;

      $window = _$window_;

      bindEditorService = _bindEditorService_;

      connector = {};
      connector.whenSynced = function(callback) {
        whenSyncedCallback = callback;
      };
      connector.sync = function() {
        whenSyncedCallback();
      };

      y = {
        observe: chai.spy(),
        val: chai.spy()
      };

      $window.Y = {
        RichText: function() {
          this.attachProvider = chai.spy();
          return this;
        }
      };
    }));

    it('should attach the editor to y.val("editor") is undefined', function() {
      var editor = 'foo';

      bindEditorService(editor, connector, y);
      // Check that nothing happened until connector is synced
      expect(y.val).to.have.been.called.exactly(0);

      // Check that we called the y.observe hook
      connector.sync();
      expect(y.observe).to.have.been.called.once;

      // Check that we're attaching to 'editor'
      expect(y.val).to.have.been.called.with.exactly('editor');
      expect(y.val).to.have.been.called.always.with('editor');
      expect(y.val).to.have.been.called.twice;
    });

    it('should get the editor from y.val("editor") when defined', function() {
      var editor = 'foo';
      var richText;

      y.val = chai.spy(function() {
        richText = richText || new $window.Y.RichText();
        richText.bind = richText.bind || chai.spy();
        return richText;
      });

      bindEditorService(editor, connector, y);
      // Check that nothing happened until connector is synced
      expect(y.val).to.have.been.called.exactly(0);

      // Check that we called the y.observe hook
      connector.sync();
      expect(y.observe).to.have.been.called.once;

      // Check that we're attaching to 'editor'
      expect(y.val).to.have.been.called.twice.with.exactly('editor');

      expect(y.val('editor').bind).to.have.been.called.once.with('QuillJs', editor);
    });
  });

  describe('collaborativeEditorDriver', function() {
    var collaborativeEditorDriver, properties, yjsService;

    beforeEach(inject(function(_collaborativeEditorDriver_, _properties_, _yjsService_) {
      collaborativeEditorDriver = _collaborativeEditorDriver_;
      properties = _properties_;
      yjsService = _yjsService_;

      properties.paneSize = {
        width: 0,
        height: 0
      };
    }));

    it('should have toggleEditor', function() {
      expect(collaborativeEditorDriver.toggleEditor).to.exist;
    });

    it('should have hideEditor', function() {
      expect(collaborativeEditorDriver.hideEditor).to.exist;
    });

    it('should have showEditor', function() {
      expect(collaborativeEditorDriver.showEditor).to.exist;
    });

    it('should have closeEditor', function() {
      expect(collaborativeEditorDriver.closeEditor).to.exist;
    });

    it('should change properties on each message got', function() {
      expect(properties.newNotification).not.to.be.true;

      yCb([{name: 'editor'}]);
      charactersCb();

      expect(properties.newNotification).to.be.true;
    });

    it('should set documentSaved=false on each message got', function() {
      properties.documentSaved = true;

      yCb([{name: 'editor'}]);
      charactersCb();

      expect(properties.documentSaved).to.be.false;
    });

    it('The wireEditor function should register a listener to quill TEXT_CHANGE event', function() {
      collaborativeEditorDriver.showEditor();

      expect(quillOnEvent).to.equal('text-change');
      expect(properties.quill.on).to.be.have.been.called.once;
    });

    it('The listener to quill TEXT_CHANGE event should set documentSaved to false', function() {
      properties.documentSaved = true;

      collaborativeEditorDriver.showEditor();
      quillOnCallback();

      expect(properties.documentSaved).to.be.false;
    });

    it('should register a listener to eventCallbackService', function() {
      expect(eventCallbackService.on).to.have.been.called.with('beforeunload')
        .and.to.have.been.called.with('conferenceleft')
        .and.to.have.been.called.twice;
    });

    it('The eventCallbackService beforeunload listener should return a string when newNotification is true', function() {
      properties.newNotification = true;

      expect(onCallback.beforeunload()).to.be.a('string');
    });

    it('The eventCallbackService beforeunload listener should return a string when there is an unsaved modification', function() {
      properties.newNotification = false;
      properties.documentSaved = false;
      properties.quill = {
        getText: function() {
          return 'Test';
        }
      };

      expect(onCallback.beforeunload()).to.be.a('string');
    });

    it('The eventCallbackService beforeunload listener should return nothing when there is no text', function() {
      properties.newNotification = false;
      properties.documentSaved = false;
      properties.quill = {
        getText: function() {
          return '';
        }
      };

      expect(onCallback.beforeunload()).to.not.exist;
    });

    it('The eventCallbackService beforeunload listener should return nothing when there is no unsaved modification', function() {
      properties.newNotification = false;
      properties.documentSaved = true;
      properties.quill = {
        getText: function() {
          return 'Test';
        }
      };

      expect(onCallback.beforeunload()).to.not.exist;
    });

    it('The eventCallbackService conferenceleft listener should return an object when newNotification is true', function() {
      properties.newNotification = true;

      expect(onCallback.conferenceleft()).to.be.an('object');
    });

    it('The eventCallbackService conferenceleft listener should return an object when there is an unsaved modification', function() {
      properties.newNotification = false;
      properties.documentSaved = false;
      properties.quill = {
        getText: function() {
          return 'Test';
        }
      };

      expect(onCallback.conferenceleft()).to.be.an('object');
    });

    it('The eventCallbackService conferenceleft listener should return nothing when there is no text', function() {
      properties.newNotification = false;
      properties.documentSaved = false;
      properties.quill = {
        getText: function() {
          return '';
        }
      };

      expect(onCallback.conferenceleft()).to.not.exist;
    });

    it('The eventCallbackService conferenceleft listener should return nothing when there is no unsaved modification', function() {
      properties.newNotification = false;
      properties.documentSaved = true;
      properties.quill = {
        getText: function() {
          return 'Test';
        }
      };

      expect(onCallback.conferenceleft()).to.not.exist;
    });

    it('The eventCallbackService conferenceleft listener should return an object when there is unsaved modification', function() {
      var callback;
      properties.newNotification = true;
      callback = onCallback.conferenceleft();

      expect(callback).to.have.property('buttons')
        .and.be.an('array');

      callback.buttons.forEach(function(button) {
        expect(button).to.have.property('text');
        expect(button).to.have.property('callback')
          .and.be.a('function');
      });
    });
  });
});
