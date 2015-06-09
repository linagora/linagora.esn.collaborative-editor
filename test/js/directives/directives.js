'use strict';

/* global chai: false */

var expect = chai.expect;
var assert = chai.assert;

describe('collaborative editor directives', function() {
  var scope, $rootScope, $window, element, $compile;


  beforeEach(function () {
    module('collaborative-editor');
    module('jadeTemplates');
    module(function ($provide) {
      $provide.service('yjsService', function () {
        return function() {
          var messageListeners = [];
          return {
            y: {},
            connector: {
              whenSynced: function() {},
              addMessageListener: function(callback) {
                messageListeners.push(callback);
              },
              getMessageListener: function() {
                return messageListeners;
              }
            }
          };
        };
      });
      $provide.provider('currentConferenceState', function () {
        this.$get = function () {
          return function() {}
        };
      });

      $provide.provider('attendeeColorsService', function () {
        this.$get = function () {
          return true;
        };
      });
    });
  });

  beforeEach(inject(function (_$rootScope_, _$window_, _$compile_) {
    $rootScope = _$rootScope_;
    $window = _$window_;
    $compile = _$compile_;
    scope = $rootScope.$new();
  }));

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
      expect(element.scope().savers.length).to.equal(3);
    });
  });
  describe('liveConferenceEditorController', function() {
    beforeEach(function() {
      element = angular.element('<div live-conference-editor-controller></div>');
      $compile(element)(scope);
      scope.$digest();

      $window.Quill = function() {
        return true;
      };
    });

    it('should populate the scope', function() {
      var localScope = element.scope();

      expect(localScope.properties).to.exist;
      expect(localScope.properties.paneSize).to.exist;
      expect(localScope.properties.editor_visible).to.be.false;
      expect(localScope.toggleEditor).to.exist;
      expect(localScope.closeEditor).to.exist;

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
      element = angular.element('<live-conference-editor></live-conference-editor>');
      $compile(element)(scope);
      scope.$digest();
    });

    it('should populate the scope', function() {
      var localScope = element.scope();

      expect(localScope.colors).to.exist;
    });

    it.skip('should pass angular-resizable.resizing events to paneSize events', function(done) {

      $rootScope.$on('paneSize', function() { done(); });
      $rootScope.$emit('angular-resizable.resizing', {width: 0});
      $rootScope.$digest();

    });

    it.skip('should pass angular-resizable.resizeEnd events to paneSize events', function(done) {

      $rootScope.$on('paneSize', function() { done(); });
      $rootScope.$emit('angular-resizable.resizeEnd', 'foo');
      $rootScope.$digest();

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
      button.scope().toggleEditor = function() { done() };

      button.find('a').click();
    });
  });
});