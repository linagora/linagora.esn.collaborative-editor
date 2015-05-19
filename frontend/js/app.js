'use strict';

angular.module('yjsEditor', ['op.live-conference'])
  .service('properties', function() {
    var quill = false;

    return function() {
      return {
        quill: quill
      };
    };
  })
  .directive('liveConferenceEditorController', ['properties', '$rootScope', function() {
    function link(properties, $scope, $rootScope) {
      properties.editor_visible = false;
      $scope.properties = properties;
      function showEditor() {
        $rootScope.$emit('paneSize', 70);
        properties.editor_visible = true;
      }
      function hideEditor() {
        $rootScope.$emit('paneSize', 100);
        properties.editor_visible = false;
      }
      $scope.toggleEditor = function() {
        if (properties.editor_visible) {
          hideEditor();
        } else {
          showEditor();
        }

        if (!properties.quill) {
          properties.quill = new window.Quill('#editor', {
            modules: {
              'multi-cursor': true,
              'link-tooltip': true,
              'image-tooltip': true,
              'toolbar': {container: '#toolbar'}
            },
            theme: 'snow'
          });
        }
      };
      $scope.closeEditor = function() {
        if (properties.quill) {
          properties.quill.destroy();
        }
        hideEditor();

      };
    }
    return {
      restrict: 'A',
      require: 'liveConference',
      link: link
    };
  }])
  .directive('liveConferenceEditor', [function() {
    function controller($scope) {
      $scope.colors = ['red', 'green', 'blue', 'yellow', 'black', 'white'];
      $scope.quill = false;
    }

    return {
      controller: controller,
      restrict: 'E',
      replace: 'true',
      templateUrl: '/yjs/views/editor.html'
    };
  }]).directive('editorTogglerElement', [
    function() {
    return {
      restrict: 'E',
      require: 'liveConference',
      replace: 'true',
      templateUrl: 'yjs/views/button.html'
    };
  }]);
