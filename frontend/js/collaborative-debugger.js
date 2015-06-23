'use strict';

angular.module('collaborativeDebugger', ['collaborative-editor', 'yjs', 'mgcrea.ngStrap'])
  .factory('contentsToHtml', ['$window', function($window) {
    var quill, container = angular.element('<div></div>').get(0);
    return function(contents) {
      quill = quill || new $window.Quill(container);
      quill.setContents(contents);
      return quill.getHTML();
    };
  }]).factory('contentGetters', ['yjsService', '$q', 'editorFactory', 'contentsToHtml', 'easyRTCService', 'DEBUG_MESSAGE',
    function(yjsService, $q, editorFactory, contentsToHtml, easyRTCService, DEBUG_MESSAGE) {
      var getYjsContents = function () {
        return $q(function (resolve, reject) {
          var html, content;
          if (!yjsService().y) {
            throw new Error('This should not happen.');
          } else if (!yjsService().y.val('editor')) {
            reject('Editor object does no exist');
          } else {
            content = {ops: yjsService().y.val('editor').getDelta()};
            html = contentsToHtml(content);
            resolve(html);
          }
        });
      };

      var getQuillContents = function () {

        return $q(function (resolve, reject) {
          var html;
          if (editorFactory.getEditor() && editorFactory.getEditor().getHTML) {
            html = editorFactory.getEditor().getHTML();
            resolve(html);
          } else {
            reject('An error ocurred while getting Quill content');
          }

        });
      };

      function getRemote(peerId, source) {

        return function () {
          return $q(function (resolve, reject) {
            function listener(sendersEasyrtcid, msgType, msgData) {
              var data = JSON.parse(msgData);
              if (data.error) {
                reject(data.error);
              } else {
                resolve(data.content);
              }
            }

            easyRTCService.setPeerListener(listener, DEBUG_MESSAGE.reply, peerId);
            easyRTCService.sendData(peerId, DEBUG_MESSAGE.ask, source);
          });
        };
      }

      return {
        quill: getQuillContents,
        yjs: getYjsContents,
        getRemote: getRemote
      };
    }
  ])
  .factory('collabDebugger', ['yjsService', 'currentConferenceState',
    function(yjsService, currentConferenceState) {
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

      var yjs = yjsService().y;

      function peerName(id) {
        return currentConferenceState.getAttendeeByEasyrtcid(id).displayName;
      }

      function fill(promise, title, container) {
        var prom;
        var error = new Error('expected first parameter to be a promise');
        if (!angular.isFunction(promise)) {
          throw error;
        } else {
          prom = promise();
          if (!angular.isFunction(prom.then)) {
            throw error;
          }
        }

        container.title = title;
        prom.then(function(html) {
          container.content = html;
          container.class = 'success';
        }, function(error) {
          container.content = error;
          container.class = 'error';
        });
      }

      var service = {
        peers: yjsPeers,
        yjs: yjs,
        fill: fill,
        peerName: peerName
      };

      return service;
    }
  ]).directive('collabDebugLauncher', ['collabDebugger', '$modal', 'contentGetters',
    function(collabDebug, $modal, contentGetters) {
    return {
      restrict: 'E',
      template: '',
      link: function(scope, element) {
        var remoteTitle, localTitle;

        var newScope = scope.$new();
        newScope.showCompare = false;

        function buildObject() {
          return {
            title: '',
            content: '',
            class: ''
          };
        }
        newScope.left = buildObject();
        newScope.right = buildObject();

        newScope.toggleCompareQuillYjs = function() {
          newScope.showCompare = !newScope.showCompare;
          if (newScope.showCompare) {
            collabDebug.fill(contentGetters.yjs, 'Yjs', newScope.left);
            collabDebug.fill(contentGetters.quill, 'Quill', newScope.right);
          }
        };

        newScope.toggleCompareOwnAndRemote = function(peerId, source) {
          var promise;
          if (!peerId) {
            throw new Error('missing first argument');
          } else if (!source) {
            throw new Error('missing second argument');
          } else {
            source = source.toLowerCase();
            if (source !== 'quill' && source !== 'yjs') {
              throw new Error('unknown source');
            }
          }

          newScope.showCompare = !newScope.showCompare;

          if (newScope.showCompare) {
            localTitle = 'Yjs (local)';
            remoteTitle = source + ' (remote: ' + collabDebug.peerName(peerId) + ')';

            newScope.right.content = 'Waiting for remote peer';
            newScope.right.class = 'waiting';

            if (source === 'quill') {
              promise = contentGetters.getRemote(peerId, 'quill');
            } else if (source === 'yjs') {
              promise = contentGetters.getRemote(peerId, 'yjs');
            } else {
              throw new Error('Unexpected source: ' + source);
            }

            collabDebug.fill(contentGetters.yjs, localTitle, newScope.left);
            collabDebug.fill(promise, remoteTitle, newScope.right);
          }
        };
        scope.onClick = function() {
          newScope.peers = collabDebug.peers();
          newScope.sharedValues = collabDebug.yjs.val();

          $modal({
            scope: newScope,
            template: '/editor/views/devmode-dialog.html'
          });
        };
      }
    };
  }]);