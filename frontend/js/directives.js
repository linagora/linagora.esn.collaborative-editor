'use strict';

angular.module('collaborative-editor')
  .directive('exportFacility', ['properties', 'saverFactory',
    function(properties, saverFactory) {
      function link(scope) {
        scope.savers = [];
        saverFactory.get().forEach(function(saver) {
          scope.savers.push({
            name: saver.name,
            tooltip: saver.tooltip,
            export: function() {
              saver.export(properties.quill);
            }
          });
        });
      }

      return {
        restrict: 'A',
        link: link
      };
    }
  ])
  .directive('liveConferenceEditorController', ['properties', 'INITIAL_PANE_SIZE', 'collaborativeEditorDriver',
    function(properties, INITIAL_PANE_SIZE, collaborativeEditorDriver) {
      function link(scope) {
        properties.editor_visible = false;
        properties.paneSize = INITIAL_PANE_SIZE;
        scope.properties = properties;
        scope.closeEditor = collaborativeEditorDriver.closeEditor;
        scope.toggleEditor = collaborativeEditorDriver.toggleEditor;
      }
      return {
        restrict: 'A',
        link: link
      };
    }])
  .directive('liveConferenceEditor', ['$rootScope', 'properties', '$window', 'detectUtils', function($rootScope, properties, $window, detectUtils) {
    function controller($scope) {
      $scope.colors = ['red', 'green', 'blue', 'yellow', 'black', 'white'];
      $scope.quill = false;
      if (detectUtils.isMobile()) {
        properties.minPaneWidth = 100;
        properties.maxPaneWidth = 100;
      } else {
        properties.minPaneWidth = 0;
        properties.maxPaneWidth = 100;
      }

      function emitResizeWidth(event, args) {
        var paneWidth = 100 * args.width / $($window).width();
        paneWidth = Math.max(properties.minPaneWidth, Math.min(properties.maxPaneWidth, paneWidth));
        $rootScope.$emit('paneSize', {width: paneWidth});
        return paneWidth;
      }

      $scope.$on('angular-resizable.resizing', emitResizeWidth);
      $scope.$on('angular-resizable.resizeEnd', function() {
        properties.paneSize.width = emitResizeWidth.apply(this, arguments);
      });
    }

    function link(scope, element) {
      function limitWidth(width) {
        return Math.max(properties.minPaneWidth, Math.min(properties.maxPaneWidth, width));
      }
      scope.$on('editor:visible', function(evt, data) {
        var width = limitWidth(data.paneSize.width) + '%';
        element.css('width', width);
        element.addClass('visible');
      });
      scope.$on('editor:hidden', function(evt, data) {
        element.css('width', '0');
        element.removeClass('visible');
      });
    }

    return {
      controller: controller,
      restrict: 'E',
      replace: 'true',
      link: link,
      templateUrl: 'editor/views/editor.html'
    };
  }])
  .directive('editorToggleElement', [
    function() {
      return {
        restrict: 'E',
        require: 'liveConference',
        replace: 'true',
        templateUrl: 'editor/views/button.html'
      };
    }
  ]);
