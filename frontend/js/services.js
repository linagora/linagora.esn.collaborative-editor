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
        documentSaved: false,
        newNotification: false
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
    'editorFactory', 'bindEditorService', '$log', '$window', 'eventCallbackService', 'saverFactory',
    function(properties, $rootScope, yjsService, editorFactory, bindEditorService, $log, $window, eventCallbackService, saverFactory) {
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

        properties.quill.on(properties.quill.constructor.events.TEXT_CHANGE, function() {
          properties.documentSaved = false;
        });
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

      function enableNotification() {
        var tmp = yjsService(),
            connector = tmp.connector,
            y = tmp.y;

        connector.addMessageListener(function(event) {
          if (y.val('editor') && y.val('editor').getText().trim() !== '') {
            properties.newNotification = true;
            properties.documentSaved = false;
          }
        });
      }

      function needSaving() {
        return properties.newNotification || (properties.quill && properties.quill.getText().trim().length > 0 && !properties.documentSaved);
      }

      function registerCallbacksOnConferenceLeft() {
        eventCallbackService.on('conferenceleft', function() {
          var savers, buttons;

          function addIdsIfMissing() {
            var html = '';
            if ($('#editor').length === 0) {
              html += '<div style="display: none" id="editor"></div>';
            }
            if ($('#toolbar').length === 0) {
              html += '<div style="display: none" id="toolbar"></div>';
            }

            if (html !== '') {
              $('body').append(html);
            }
          }

          addIdsIfMissing();

          if (!properties.quill) {
            wireEditor();
          }
          if (needSaving()) {
            savers = saverFactory.get();
            buttons = savers.map(function(saver) {
              return {
                text: saver.name,
                callback: function() {
                  saver.export(editorFactory.getEditor());
                }
              };
            });
            return {
              message: 'Did you save your notes?',
              buttonMessage: 'Save as',
              buttons: buttons,
              urgency: 'question'
            };
          } else {
            return null;
          }
        });
      }

      function registerCallbacksOnBeforeUnload() {
        eventCallbackService.on('beforeunload', function() {
          return needSaving() ?
            'There is an unsaved document in the collaborative editor, do you want to stay in the conference and save it?' :
            null;
        });
      }

      enableNotification();
      registerCallbacksOnConferenceLeft();
      registerCallbacksOnBeforeUnload();

      return {
        toggleEditor: toggleEditor,
        hideEditor: hideEditor,
        showEditor: showEditor,
        closeEditor: closeEditor
      };
    }
  ]);
