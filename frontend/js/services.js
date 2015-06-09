'use strict';

angular.module('collaborative-editor')
  .factory('saverFactory', [function() {
    var savers = [];
    return {
      register: function(name, tooltip, exportFunction) {
        savers.push({
          name: name,
          tooltip: tooltip,
          export: exportFunction
        });
      },
      unregister: function(name) {
        savers = savers.filter(function(saver) {
          return saver.name !== name;
        });
      },
      get: function() {
        return savers;
      }
    };
  }])
  .service('properties', function() {
    var quill = false;
    return function() {
      return {
        quill: quill,
        newNotification: 0
      };
    };
  })
  .factory('editorFactory', ['$window', '$document', function($window) {
    var quill = false;
    return {
      getEditor: function() {
        if (!quill) {
          quill = new $window.Quill('#editor', {
            modules: {
              'multi-cursor': true,
              'link-tooltip': true,
              'image-tooltip': true,
              'toolbar': {
                container: '#toolbar'
              }
            },
            theme: 'snow'
          });
        }
        return quill;
      }
    };
  }])
  .service('attachInformationProviderService', ['currentConferenceState', 'attendeeColorsService',
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
  .service('bindEditorService', ['attachInformationProviderService', '$window',
    function(attachInformationProvider, $window) {
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
            richText = new $window.Y.RichText('QuillJs', editor);
            attachInformationProvider(richText);
            y.val('editor', richText);
          } else {
            richText = y.val('editor');
            attachInformationProvider(richText);
            richText.bind('QuillJs', editor);
          }
        });
      };
    }
  ])
.factory('collaborativeEditorDriver', ['properties', '$rootScope', 'yjsService',
    'editorFactory', 'bindEditorService', '$log', '$window', 'collaborativeEditorNotification',
    function(properties, $rootScope, yjsService, editorFactory, bindEditorService, $log, $window, collaborativeEditorNotification) {
      function showEditor() {
        if (!properties.quill) {
          wireEditor();
        }
        $rootScope.$emit('paneSize', {width: properties.paneSize.width});
        properties.editor_visible = true;
        $rootScope.$broadcast('editor:visible', properties);
      }
      function hideEditor() {
        $rootScope.$emit('paneSize', {width: 0});
        $rootScope.$broadcast('editor:hidden', properties);
        properties.editor_visible = false;
      }

      function wireEditor() {
        properties.quill = editorFactory.getEditor();
        var ret = yjsService();
        properties.y = ret.y;
        properties.connector = ret.connector;
        $log.info('Editor objects', properties.y, properties.connector, properties.quill);
        $window.y = ret.y;
        $window.quill = properties.quill;

        bindEditorService(properties.quill, properties.connector, properties.y);
      }

      function toggleEditor() {
        if (properties.editor_visible) {
          hideEditor();
        } else {
          showEditor();
        }
        properties.newNotification = false;
      }

      function closeEditor() {
        if (properties.quill) {
          properties.quill.destroy();
        }
        hideEditor();
      }

      return {
        toggleEditor: toggleEditor,
        hideEditor: hideEditor,
        showEditor: showEditor,
        closeEditor: closeEditor
      };
    }]
  )
  .factory('collaborativeEditorNotification', ['properties', 'yjsService',
    function(properties, yjsService) {
      var tmp = yjsService(),
        connector = tmp.connector,
        y = tmp.y;

      connector.addMessageListener(function(event) {
        if (y.val('editor') && y.val('editor').getText().trim() !== '') {
          properties.newNotification = true;
        }
      });
      return true;
    }]);
