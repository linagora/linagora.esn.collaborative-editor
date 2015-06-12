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
    'editorFactory', 'bindEditorService', '$log', '$window', 'eventCallbackService', 'saverFactory', 'i18nService',
    function(properties, $rootScope, yjsService, editorFactory, bindEditorService, $log, $window, eventCallbackService, saverFactory, i18nService) {
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
              var faClass, text, isDefault;
              switch(saver.name) {
                case 'pdf':
                  faClass = 'fa-file-pdf-o';
                  text = "PDF";
                  isDefault = true;
                  break;
                case 'text':
                  faClass = 'fa-file-o';
                  text = "Raw text";
                  isDefault = false;
                  break;
                case 'markdown':
                  faClass = 'fa-file-text-o';
                  text = "Markdown";
                  isDefault = false;
                  break;
                default:
                  faClass = 'fa-file-o';
                  text = "Unknown";
                  isDefault = false;
                  break;
              }
              return {
                beforeLink: '<i class="fa ' + faClass + '"></i>',
                default: isDefault,
                text: text,
                callback: function() {
                  saver.export(editorFactory.getEditor());
                }
              };
            });
            return {
              onLeft: '<div class="text-editor-icon"></div>',
              onRight: '<i class="fa fa-4x fa-question"></i>',
              beforeButton: 'Hey! It seems you\'ve unsaved modifications in the collaborative editor. Save it as',
              afterButton: '?',
              buttons: buttons,
              urgency: 'question'
            };
          } else {
            return null;
          }
        });
      }

      function registerCallbacksOnBeforeUnload() {
        i18nService.__('There is an unsaved document in the collaborative editor, do you want to stay in the conference and save it?').then(function(text) {
          eventCallbackService.on('beforeunload', function() {
            return needSaving() ? text : null;
          });
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
