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
  .service('AttachInformationProviderService', ['currentConferenceState', 'attendeeColorsService',
    function(currentConferenceState, attendeeColorsService) {
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
    }
  ])
  .service('bindEditorService', ['AttachInformationProviderService', function(attachInformationProvider) {
    return function(editor, connector, y) {
      var richText;
      connector.whenSynced(function() {
        y.observe(function(events) {
          var i;
          for (i in events) {
            if (events[i].name === 'editor') {
              richText = y.val('editor');
              richText.bind('QuillJs', editor);
              attachInformationProvider(richText);
            }
          }
        });
        if (y.val('editor') === undefined) {
          richText = new window.Y.RichText('QuillJs', editor);
          attachInformationProvider(richText);
          y.val('editor', richText);
        } else {
          richText = y.val('editor');
          attachInformationProvider(richText);
          richText.bind('QuillJs', editor);
        }
      });
    };
  }])
  .constant('INITIAL_PANE_SIZE', {
    width: 70,
    height: 100
  })
  .directive('liveConferenceEditorController', ['properties', '$rootScope',
    'yjsService', 'editorService', 'bindEditorService', '$log', 'INITIAL_PANE_SIZE',
    function(properties, $rootScope, yjsService, editorService, bindEditorService, $log, INITIAL_PANE_SIZE) {
      function link(scope) {
        properties.editor_visible = false;
        properties.paneSize = INITIAL_PANE_SIZE;
        scope.properties = properties;
        function showEditor() {
          $rootScope.$emit('paneSize', {width: properties.paneSize.width});
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
  .directive('liveConferenceEditor', ['$rootScope', 'properties', function() {
    function controller($scope, $rootScope, properties) {
      $scope.colors = ['red', 'green', 'blue', 'yellow', 'black', 'white'];
      $scope.quill = false;

      function emitResizeWidth(event, args) {
        var paneWidth = 100 * args.width / $(window).width();
        $rootScope.$emit('paneSize', {width: paneWidth});
        return paneWidth;
      }

      $scope.$on('angular-resizable.resizing', emitResizeWidth);
      $scope.$on('angular-resizable.resizeEnd', function() {
        properties.paneSize.width = emitResizeWidth.apply(this, arguments);
      });
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