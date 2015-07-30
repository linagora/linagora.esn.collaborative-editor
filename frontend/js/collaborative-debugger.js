'use strict';

angular.module('collaborativeDebugger', ['collaborative-editor', 'yjs', 'mgcrea.ngStrap'])
  /**
    * This is a hack to convert deltas (@see https://github.com/ottypes/rich-text) into html
    * using quill
    **/
  .factory('contentsToHtml', ['$window', function($window) {
    var quill, container = angular.element('<div></div>').get(0);
    return function(contents) {
      quill = quill || new $window.Quill(container);
      quill.setContents(contents);
      return quill.getHTML();
    };
  }])
  /**
    * Exposes local quill and yjs content getter (as HTML) and a remote contentGetter as promises.
    **/
  .factory('contentGetters', ['yjsService', '$q', 'editorFactory', 'contentsToHtml', 'easyRTCService', 'DEBUG_MESSAGE',
    function(yjsService, $q, editorFactory, contentsToHtml, easyRTCService, DEBUG_MESSAGE) {

      /**
        * Get the local yjs content as HTML
        * @return {Promise} return a promise
        **/
      function getYjsContents() {
        return $q(function(resolve, reject) {
          var html, content;
          if (!yjsService.y) {
            throw new Error('This should not happen.');
          } else if (!yjsService.y.val('editor')) {
            reject('Editor object does no exist');
          } else {
            content = {ops: yjsService.y.val('editor').getDelta()};
            html = contentsToHtml(content);
            resolve(html);
          }
        });
      }

      /**
        * Get the local quill content as HTML
        * @return {Promise} return a promise
        **/
      function getQuillContents() {
        return $q(function(resolve, reject) {
          var html;
          if (editorFactory.getEditor() && editorFactory.getEditor().getHTML) {
            html = editorFactory.getEditor().getHTML();
            resolve(html);
          } else {
            reject('An error ocurred while getting Quill content');
          }

        });
      }

      /**
        * Get some remote content
        * @param {String} peerId the peer to contact
        * @param {String} source either 'yjs' or 'quill'
        * @return {Promise} return a promise
        **/
      function getRemote(peerId, source) {
        return function() {
          return $q(function(resolve, reject) {
            function listener(sendersEasyrtcid, msgType, msgData) {
              var data = msgData;
              if (data.error) {
                reject(data.error);
              } else {
                resolve(data.content);
              }
            }

            easyRTCService.setPeerListener(listener, DEBUG_MESSAGE.reply + source, peerId);
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
  .factory('collabDebugger', ['yjsService', 'currentConferenceState', 'contentGetters', '$q',
    function(yjsService, currentConferenceState, contentGetters, $q) {
      function yjsPeers() {
        var id, peers = [],
          connections = yjsService.connector.connections;
        for (id in connections) {
          peers.push({
            id: id,
            is_synced: connections[id].is_synced,
            infos: currentConferenceState.getAttendeeByEasyrtcid(id)
          });
        }
        return peers;
      }

      var yjs = yjsService.y;

      function peerName(id) {
        return currentConferenceState.getAttendeeByEasyrtcid(id).displayName;
      }

      /**
        * Fill the container by calling the promise.
        * @param {Promise} promise the promise to get the content
        * @param {String} title the title of the container
        * @param {Object} container the container to which attach the title and the content
        **/
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
    function(collabDebugger, $modal, contentGetters) {
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
            collabDebugger.fill(contentGetters.yjs, 'Yjs', newScope.left);
            collabDebugger.fill(contentGetters.quill, 'Quill', newScope.right);
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
            remoteTitle = source + ' (remote: ' + collabDebugger.peerName(peerId) + ')';

            newScope.right.content = 'Waiting for remote peer';
            newScope.right.class = 'waiting';

            if (source === 'quill') {
              promise = contentGetters.getRemote(peerId, 'quill');
            } else if (source === 'yjs') {
              promise = contentGetters.getRemote(peerId, 'yjs');
            } else {
              throw new Error('Unexpected source: ' + source);
            }

            collabDebugger.fill(contentGetters.yjs, localTitle, newScope.left);
            collabDebugger.fill(promise, remoteTitle, newScope.right);
          }
        };
        scope.onClick = function() {
          newScope.peers = collabDebugger.peers();
          newScope.sharedValues = collabDebugger.yjs.val();

          $modal({
            scope: newScope,
            template: '/editor/views/devmode-dialog.html'
          });
        };
      }
    };
  }]).directive('compareLocalAndAllRemote', ['collabDebugger', 'contentGetters', '$q', function(collabDebugger, contentGetters, $q) {
    return {
      restrict: 'A',
      templateUrl: '/editor/views/partials/debug-global-compare.html',
      scope: {
        doCompareYjs: '=',
        doCompareQuill: '='
      },
      link: function(scope, element) {
        var peers = collabDebugger.peers();
        var tmpCompareName = [];

        scope.showCompare = false;
        scope.compareName = '';

        if (scope.doCompareYjs) {
          tmpCompareName.push('yjs');
        }
        if (scope.doCompareQuill) {
          tmpCompareName.push('Quill');
        }
        scope.compareName = tmpCompareName.join(' and ');

        scope.compare = function() {
          scope.showCompare = true;
          scope.peers = peers;
          peers.forEach(function(peer) {
            var promises = [contentGetters.yjs(), contentGetters.quill()];

            if (scope.doCompareYjs) {
              promises.push(contentGetters.getRemote(peer.id, 'yjs')());
            }
            if (scope.doCompareQuill) {
              promises.push(contentGetters.getRemote(peer.id, 'quill')());
            }

            $q.all(promises).then(function(results) {
              // one liner that check that all the results are equal
              peer.hasSameContent = results.reduce(function(a, b) {
                return (a === b) ? a : false;
              }) === results[0];
            });
          });
        };
      }
    };
  }]);
