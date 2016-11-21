'use strict';

angular.module('collaborative-editor')
  /**
    * A factory to register saver fold-functions
    * @return {Object} an object containing a register function, an unregister function and a get function
    **/
  .factory('saverFactory', ['i18nService', function() {
    var savers = [];
    return {
      /**
        * Register a new saver
        * @param {String} name the name of the saver
        * @param {Function} the function tocall to save
        * @param {Object} other an object that can defined beforeLink, afterLink
            and default to decorate the 'save' button
        **/
      register: function(name, exportFunction, other) {
        savers.push({
          name: name,
          export: exportFunction,
          other: other
        });
      },
      /** Unregister a function
        * @param {String} name the name of the saver to remove
        **/
      unregister: function(name) {
        savers = savers.filter(function(saver) {
          return saver.name !== name;
        });
      },
      /** Get all the savers
        * @return {Array} an array containing the savers
        **/
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
  /**
    * Creates an editor object lazily
    * @return {Object} an object with a getEditor method to get and initialize the editor
    **/
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
  /**
    * Attach a name provider and a color provider to the yjs rich text object
    **/
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
  /**
    * Bind the quill editor, yjs and yjs' richt-text object together
    *
    * Since yjs is only available when there's a connection, everything is wrapped inside a connector.whenSynced
    * Any yjs object has an observer method that is called each time one of its element (but not subelements) is modified.
    * If a root object, like the rich-text object is modified, we have to wire it back to quill.
    *
    * On startup, either the rich-text object is undefined and we initialize it with quill and wire it to yjs (case (2))
    * either is is defined and bound to yjs (case (1)) and we wire it to quill

    **/
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

          if (y.val('editor') === undefined) { // case (1)
            richText = new $window.Y.RichText('QuillJs', editor);
            attachInformationProvider(richText);
            y.val('editor', richText);
          } else { // case (2)
            richText = y.val('editor');
            attachInformationProvider(richText);
            richText.bind('QuillJs', editor);
          }
        });
      };
    }
  ])
  .factory('registerCallbacks', ['eventCallbackService', 'i18nService', 'properties',
    'saverFactory', 'easyRTCService', 'DEBUG_MESSAGE', 'editorFactory', 'yjsService', '$log', 'bindEditorService', 'contentGetters',
    function(eventCallbackService, i18nService, properties, saverFactory, easyRTCService, DEBUG_MESSAGE, editorFactory,
      yjsService, $log, bindEditorService, contentGetters) {

      function wireEditor() {
        properties.quill = editorFactory.getEditor();
        properties.y = yjsService.y;
        properties.connector = yjsService.connector;
        $log.info('Editor objects', properties.y, properties.connector, properties.quill);

        bindEditorService(properties.quill, properties.connector, properties.y);

        properties.quill.on(properties.quill.constructor.events.TEXT_CHANGE, function() {
          properties.documentSaved = false;
        });
      }

      function needSaving() {
        return properties.newNotification || (properties.quill && properties.quill.getText().trim().length > 0 && !properties.documentSaved);
      }

      /** Registers a callback to be called on 'conferenceleft' event **/
      function registerCallbacksOnConferenceLeft() {
        i18nService.getCatalog().then(function(catalog) {
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
                  beforeLink: '<i class="fa ' + saver.other.faClass + '"></i>',
                  default: saver.other.default,
                  text: saver.name,
                  callback: function() {
                    saver.export(editorFactory.getEditor());
                  }
                };
              });
              return {
                onLeft: '<div class="text-editor-icon"></div>',
                onRight: '<i class="fa fa-4x fa-question"></i>',
                beforeButton: catalog['There is an unsaved document in the collaborative editor. Save it now to prevent data loss.'],
                buttons: buttons
              };
            } else {
              return null;
            }
          });
        });
      }

      /** Registers a callback to be called on 'beforeunload' event **/
      function registerCallbacksOnBeforeUnload() {
        i18nService.__('There is an unsaved document in the collaborative editor, do you want to stay in the conference and save it?').then(function(text) {
          eventCallbackService.on('beforeunload', function() {
            return needSaving() ? text : null;
          });
        });
      }

      /** Listens to P2P debug messages and reply to them **/
      function replyOnAskWholeContent() {
        easyRTCService.setPeerListener(function(sendersEasyrtcid, msgType, msgData) {
          var source = msgData;

          var getContent;

          if (msgData === 'quill') {
            getContent = contentGetters.quill();
          } else if (msgData === 'yjs') {
            getContent = contentGetters.yjs();
          } else {
            easyRTCService.sendData(sendersEasyrtcid, DEBUG_MESSAGE.reply + source, {error: 'Unknown data source'});
          }

          getContent.then(function(html) {
            easyRTCService.sendData(sendersEasyrtcid, DEBUG_MESSAGE.reply + source, {content: html});
          }, function(error) {
            easyRTCService.sendData(sendersEasyrtcid, DEBUG_MESSAGE.reply + source, {error: error});
          });
        }, DEBUG_MESSAGE.ask);
      }

      replyOnAskWholeContent();
      registerCallbacksOnConferenceLeft();
      registerCallbacksOnBeforeUnload();

      return {
        wireEditor: wireEditor
      };
    }
  ])
  /** Make it possible to toggle, show, hide and notify of events of the editor **/
  .factory('collaborativeEditorDriver', ['properties', '$rootScope', 'registerCallbacks', '$window', 'yjsService',
    function(properties, $rootScope, registerCallbacks, $window, yjsService) {
      function showEditor() {
        if (!properties.quill) {
          registerCallbacks.wireEditor();
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
        var y = yjsService.y;

        y.observe(function(events) {
         events.forEach(function(event) {
           if (event.name === 'editor') {
              y.val('editor')._model.getContent('characters').observe(function() {
                properties.newNotification = true;
                properties.documentSaved = false;
             });
           }
          });
        });
      }

      enableNotification();

      return {
        toggleEditor: toggleEditor,
        hideEditor: hideEditor,
        showEditor: showEditor,
        closeEditor: closeEditor
      };
    }
  ]);
