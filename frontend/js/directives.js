'use strict';

angular.module('collaborative-editor')
  .directive('exportFacility', ['properties', 'saverFactory',
    function(properties, saverFactory) {
      function link(scope) {
        scope.savers = [];
        saverFactory.get().forEach(function(saver) {
          scope.savers.push({
            name: saver.name,
            other: saver.other,
            export: function() {
              saver.export(properties.quill);
              properties.documentSaved = true;
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
        properties.maxPaneWidth = 70;
      }

      function emitResizeWidth(event, args) {
        var windowWidth = angular.element($window).width(),
            paneWidthInPercent = 100 * args.width / windowWidth,
            normalizedPaneWidthInPercent = Math.max(properties.minPaneWidth, Math.min(properties.maxPaneWidth, paneWidthInPercent));

        $rootScope.$broadcast('paneSize', {
          width: normalizedPaneWidthInPercent,
          rawWidthInPercent: paneWidthInPercent,
          widthInPixels: windowWidth * normalizedPaneWidthInPercent / 100,
          normalized: normalizedPaneWidthInPercent !== paneWidthInPercent
        });

        return normalizedPaneWidthInPercent;
      }

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
      scope.$on('paneSize', function(evt, data) {
        if (data.normalized) {
          element.css('width', data.rawWidthInPercent >= 90 ? '100%' : data.widthInPixels);
        }
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
  ])
  .directive('editorClickHandler', ['properties', function(properties) {
    return {
      restrict: 'A',
      link: function(scope, element, attrs) {
        element.click(function() {
          var quillSelection, start, end, quill = properties.quill;
          if (quill) {
            quillSelection = quill.getSelection();

            if (quillSelection !== null) {
              start = quillSelection.start;
              end = quillSelection.end;
            } else {
              start = end = quill.getLength() - 1;
            }

            quill.setSelection(start, end);
          }
        });
      }
    };
  }]);
