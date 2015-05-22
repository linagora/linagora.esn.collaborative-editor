'use strict';

function create_editor() {
  return new window.Quill('#editor', {
    modules: {
      'multi-cursor': true,
      'link-tooltip': true,
      'image-tooltip': true,
      'toolbar': {container: '#toolbar'}
    },
    theme: 'snow'
  });
}

function bind_editor_to_yjs(editor, connector, y) {
  connector.whenSynced(function() {
    y.observe(function(events) {
      for (var i in events) {
        if (events[i].name === 'editor') {
          y.val('editor').bind('QuillJs', editor);
        }
      }
    });
    if (y.val('editor') === undefined) {
      y.val('editor', new window.Y.RichText('QuillJs', editor));
    } else {
      y.val('editor').bind('QuillJs', editor);
    }
  });
}
angular.module('collaborative-editor', ['op.live-conference'])
  .service('properties', function() {
    var quill = false;
    return function() {
      return {
        quill: quill
      };
    };
  })
  .directive('liveConferenceEditorController', ['properties', '$rootScope', 'yjsService', function() {
    function link(properties, $scope, $rootScope, yjsService) {
      properties.editor_visible = false;
      $scope.properties = properties;
      function showEditor() {
        $rootScope.$emit('paneSize', {width: 70});
        properties.editor_visible = true;
      }
      function hideEditor() {
        $rootScope.$emit('paneSize', {width: 0});
        properties.editor_visible = false;
      }
      $scope.toggleEditor = function() {
        if (properties.editor_visible) {
          hideEditor();
        } else {
          showEditor();
        }

        if (!properties.quill) {
          properties.quill = create_editor();
          var ret = yjsService();
          properties.y = ret.y;
          console.log('yjs', properties.y);
          properties.connector = ret.connector;
          bind_editor_to_yjs(properties.quill, properties.connector, properties.y);
        }
      };

      $scope.properties = properties;

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
      controller: link
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
