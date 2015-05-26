'use strict';

angular.module('collaborative-editor', ['op.live-conference', 'angularResizable'])
  .service('properties', function() {
    var quill = false;
    return function() {
      return {
        quill: quill
      };
    };
  })
  .service('editorService', [function() {
    return function() {
      var quill = new window.Quill('#editor', {
        modules: {
          'multi-cursor': true,
          'link-tooltip': true,
          'image-tooltip': true,
          'toolbar': {container: '#toolbar'}
        },
        theme: 'snow'
      });
      return quill;
    };
  }])
  .service('AttachInformationProviderService', ['currentConferenceState', 'attendeeColorsService', function(currentConferenceState, attendeeColorsService){
    return function(richtextInstance) {
      richtextInstance.attachProvider('nameProvider', function(rtcId) {
        var attendee = currentConferenceState.getAttendeeByEasyrtcid(rtcId);
        return attendee.displayName;
      });
      richtextInstance.attachProvider('colorProvider', function(rtcId) {
        var attendee = currentConferenceState.getAttendeeByEasyrtcid(rtcId);
        return attendeeColorsService.getColorForAttendeeAtIndex(attendee.index);
      });
    };
  }])
  .service('bindEditorService', ['AttachInformationProviderService', function(AttachInformationProvider) {
    return function(editor, connector, y) {
      connector.whenSynced(function() {
        y.observe(function(events) {
          var i;
          for (i in events) {
            if (events[i].name === 'editor') {
              var richText = y.val('editor');
              richText.bind('QuillJs', editor);
              AttachInformationProvider(richText);
            }
          }
        });
        if (y.val('editor') === undefined) {
          var richText = new window.Y.RichText('QuillJs', editor);
          AttachInformationProvider(richText);
          y.val('editor', richText);
        } else {
          var richText = y.val('editor');
          AttachInformationProvider(richText);
          richText.bind('QuillJs', editor);
        }
      });
    };
  }])
  .directive('liveConferenceEditorController', ['properties', '$rootScope', 'yjsService', 'editorService', 'bindEditorService', '$log',
    function(properties, $rootScope, yjsService, editorService, bindEditorService, $log) {
      function link(scope) {
        properties.editor_visible = false;
        scope.properties = properties;
        function showEditor() {
          $rootScope.$emit('paneSize', {width: 70});
          properties.editor_visible = true;
        }
        function hideEditor() {
          $rootScope.$emit('paneSize', {width: 0});
          properties.editor_visible = false;
        }
        scope.toggleEditor = function() {
          if (properties.editor_visible) {
            hideEditor();
          } else {
            showEditor();
          }

          if (!properties.quill) {
            properties.quill = editorService();
            var ret = yjsService();
            properties.y = ret.y;
            properties.connector = ret.connector;
            $log.info('Editor objects', properties.y, properties.connector, properties.quill);
            window.y = ret.y;
            window.quill = properties.quill;
            bindEditorService(properties.quill, properties.connector, properties.y);
          }
        };

        scope.properties = properties;

        scope.closeEditor = function() {
          if (properties.quill) {
            properties.quill.destroy();
          }
          hideEditor();
        };
      }
    return {
      restrict: 'A',
      link: link
    };
    }])
  .directive('liveConferenceEditor', ['$rootScope', function() {
    function controller($scope, $rootScope) {
      $scope.colors = ['red', 'green', 'blue', 'yellow', 'black', 'white'];
      $scope.quill = false;

      function emitResize(event, args) {
        var paneWidth = 100 * args.width / $(window).width();
        $rootScope.$emit('paneSize', {width: paneWidth});
      }

      $scope.$on('angular-resizable.resizing', emitResize);
      $scope.$on('angular-resizable.resizeEnd', emitResize);
    }

    return {
      controller: controller,
      restrict: 'E',
      replace: 'true',
      templateUrl: 'editor/views/editor.html'
    };
  }]).directive('editorToggleElement', [
    function() {
      return {
        restrict: 'E',
        require: 'liveConference',
        replace: 'true',
        templateUrl: 'editor/views/button.html'
      };
    }]);
