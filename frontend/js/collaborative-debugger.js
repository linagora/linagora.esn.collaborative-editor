'use strict';

angular.module('collaborativeDebugger', ['collaborative-editor', 'yjs'])
  .factory('collabDebugger', ['yjsService', 'currentConferenceState', 'editorFactory', '$window',
    function(yjsService, currentConferenceState, editorFactory, $window) {
      var compare = false;
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
      var getYjsContents = function() {
        if (yjsService().y && yjsService().y.val && yjsService().y.val('editor')) {
          return { ops: yjsService().y.val('editor').getDelta() };
        } else {
          return { ops: [ { insert: 'Yjs is not ready!'} ]};
        }
      };

      var getQuillContents = function() {
        return editorFactory.getEditor().getContents();
      };

      var yjs = yjsService().y;

      function fillYjsContents(element) {
        element.setContents(getYjsContents());
      }
      function fillQuillContents(element) {
        element.setContents(getQuillContents());
      }

      function peerName(id) {
        return currentConferenceState.getAttendeeByEasyrtcid(id).displayName;
      }


      var service = {
        compare: compare,
        peers: yjsPeers,
        yjs: yjs,
        fillYjsContents: fillYjsContents,
        fillQuillContents: fillQuillContents,
        peerName: peerName
      };

      return service;
    }
  ]).directive('collabDebugLauncher', ['collabDebugger', '$modal', 'easyRTCService', 'DEBUG_MESSAGE', function(collabDebug, $modal, easyRTCService, DEBUG_MESSAGE) {
    return {
      restrict: 'E',
      template: '',
      link: function(scope, element) {
        function onClick() {
          scope.peers = collabDebug.peers();
          scope.sharedValues = collabDebug.yjs.val();
          scope.showCompare = false;

          scope.toggleCompareQuillYjs = function() {
            scope.showCompare = !scope.showCompare;
            if (scope.showCompare) {
              initIfAbsent();
              scope.leftTitle = 'Yjs';
              scope.rightTitle = 'Quill';

              collabDebug.fillYjsContents(scope.left);
              collabDebug.fillQuillContents(scope.right);
            }
          };

          scope.toggleCompareOwnAndRemote = function(peerId) {
            var listener;
            scope.showCompare = !scope.showCompare;

            if (scope.showCompare) {
              initIfAbsent();
              scope.leftTitle = 'Yjs (local)';
              scope.rightTitle = 'Yjs (remote: ' + collabDebug.peerName(peerId) + ')';

              scope.right.setContents({ops: [{insert: 'Waiting for remote peer…'}]});

              easyRTCService.addPeerListener(function(sendersEasyrtcid, msgType, msgData) {
                if (msgType === DEBUG_MESSAGE.get_content && sendersEasyrtcid === peerId) {
                  scope.right.setContents(JSON.parse(msgData));
                }
                easyRTCService.removePeerListener(listener);
              });

              easyRTCService.sendData(peerId, DEBUG_MESSAGE.ask_for_content, '');

              collabDebug.fillYjsContents(scope.left);
            }
          };

          function initIfAbsent() {
            if (!scope.left) {
              scope.left = new Quill('.side-by-side .left .container');
            }
            if (!scope.right) {
              scope.right = new Quill('.side-by-side .right .container');
            }
          }

          $modal({
            scope: scope,
            template: '/editor/views/devmode-dialog.html'
          });
        }

        element.on('click', onClick);
      }
    };
  }]);