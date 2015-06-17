'use strict';

angular.module('collaborativeDebugger', ['collaborative-editor', 'yjs'])
  .factory('collabDebugger', ['yjsService', 'currentConferenceState', 'editorFactory',
    function(yjsService, currentConferenceState, editorFactory) {
      function yjsPeers() {
        var id, peers = [],
            connections = yjsService().connector.connections;

        for (id in connections) {
          peers.push({
            id: id,
            is_synced: connections[id].is_synced,
            infos: currentConferenceState.getAttendeeByEasyrtcid(id)
          });
        }
        return peers;
      }

      function generateCompareQuillAndYjs($modal) {
        var quillHtml = editorFactory.getContents(),
            yjsDeltas = {ops: yjsService().y.val('editor').getDeltas};

        $modal({
          template: '/editor/views/compare.html'
        });


      }

      var yjs = yjsService().y;

      var service = {
        peers: yjsPeers,
        yjs: yjs,
        generateCompareQuillAndYjs: generateCompareQuillAndYjs
      };

      return service;
    }
  ]).directive('collabDebugLauncher', ['collabDebugger', '$modal', function(collabDebug, $modal) {
    return {
      restrict: 'E',
      template: '',
      link: function(scope, element) {
        function onClick() {
          scope.peers = collabDebug.peers();
          scope.sharedValues = collabDebug.yjs.val();
          scope.compareQuillAndYjs = function() {
            return collabDebug.generateCompareQuillAndYjs($modal);
          };

          $modal({
            scope: scope,
            template: '/editor/views/devmode-dialog.html'
          });
        }

        element.on('click', onClick);
      }
    };
  }]);