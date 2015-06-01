'use strict';

angular.module('collaborative-editor', ['op.live-conference', 'angularResizable'])
  .service('properties', function() {
    var quill = false;
    return function() {
      return {
        quill: quill
      };
    };
  })
  .factory('editorFactory', ['$window', '$document', function($window, $document) {
    var quill = false;

    return {
      getEditor: function() {
        if (!quill) {
          quill = new $window.Quill('#editor', {
            modules: {
              'multi-cursor': true,
              'link-tooltip': true,
              'image-tooltip': true,
              'toolbar': {container: '#toolbar'}
            },
            theme: 'snow'
          });
        }
        return quill;
      }
    };
  }])
  .service('AttachInformationProviderService', ['currentConferenceState', 'attendeeColorsService',
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
  .service('bindEditorService', ['AttachInformationProviderService', '$window',
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
  .constant('INITIAL_PANE_SIZE', {
    width: 70,
    height: 100
  })
  .constant('QUILL_TO_PDFMAKE_STYLE_EQUIVALENCE', {
    'bold': 'bold',
    'underline' : 'underline',
    'italic': 'italics',
    'size': 'fontSize',
    'align': 'alignment',
    'bullet': 'bullet',
    'list': 'list',
    'color': 'color'
  })
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
          return saver.name === name;
        });
      },
      get: function() {
        return savers;
      }
    };
  }])
  .run(['QUILL_TO_PDFMAKE_STYLE_EQUIVALENCE', '$window', 'saverFactory',
    function(QUILL_TO_PDFMAKE_STYLE_EQUIVALENCE, $window, saverFactory) {
      function generate(editor) {
        var deltas = editor.getContents().ops;
        var processLater = [];
        var INSERT = 1, NEWLINE = 2, FORMAT_PARAGRAPH = 3;
        var valueMiddleWare = function(key, value) {
          if (key === 'size') {
            return value.substring(0, value.indexOf('px'));
          } else {
            return value;
          }
        };

        function formatAttributes(attributes) {
          var processedAttributes = {};
          for (var key in attributes) {
            var value = attributes[key];
            if (key in QUILL_TO_PDFMAKE_STYLE_EQUIVALENCE) {
              processedAttributes[QUILL_TO_PDFMAKE_STYLE_EQUIVALENCE[key]] = valueMiddleWare(key, value);
            }
          }
          return processedAttributes;
        }

        function copyAttributes(from, to) {
          for (var key in from) {
            to[key] = from[key];
          }
        }

        deltas.forEach(function(delta) {
          if (delta.insert === undefined) {
            return;
          }

          var lineLength = delta.insert.indexOf('\n');
          var from = 0;

          while (true) {
            if (lineLength >= 1) {
              processLater.push({
                action: INSERT,
                content: delta.insert.substr(from, lineLength),
                format: formatAttributes(delta.attributes || [])
              });
              processLater.push({action: NEWLINE});
              // +1 to skip the '\n'
              from += lineLength + 1;
              lineLength = delta.insert.substr(from).indexOf('\n');

            } else if (lineLength === 0) {
              processLater.push({
                action: FORMAT_PARAGRAPH,
                format: formatAttributes(delta.attributes || [])
              });
              processLater.push({action: NEWLINE});
              from += 1;
              lineLength = delta.insert.substr(from).indexOf('\n');

            } else {
              processLater.push({
                action: INSERT,
                content: delta.insert.substr(from),
                format: formatAttributes(delta.attributes || [])
              });
              lineLength = delta.insert.substr(from).indexOf('\n');
              break;
            }
          }
        });

        var paragraphs = [{text: []}];

        processLater.forEach(function(action) {
          var lastItem = paragraphs.length - 1;
          if (action.action === INSERT) {
            var line = {text: action.content};
            copyAttributes(action.format, line);
            paragraphs[lastItem].text.push(line);

          } else if (action.action === NEWLINE) {
            paragraphs.push({text: []});

          } else if (action.action === FORMAT_PARAGRAPH) {
            copyAttributes(action.format, paragraphs[lastItem]);

            if ('bullet' in action.format) {
              paragraphs[lastItem].ul = paragraphs[lastItem].text;
              delete paragraphs[lastItem].text;

            } else if ('list' in action.format) {
              paragraphs[lastItem].ol = paragraphs[lastItem].text;
              delete paragraphs[lastItem].text;
            }
          }
        });

        $window.pdfMake.createPdf({content: paragraphs}).download();
      }

      saverFactory.register('pdf', 'Save as pdf', generate);
    }
  ])
  .run(['$window', 'saverFactory', function($window, saverFactory) {
    function generate(editor) {
      var text = editor.getText();
      var blob = new Blob([text], {type: 'text/plain;charset=utf-8'});

      $window.saveAs(blob, 'meeting.txt');
    }

    saverFactory.register('text', 'Save as raw text', generate);
  }])
  .run(['$window', 'saverFactory', function($window, saverFactory) {
    function generate(editor) {
      var html = editor.getHTML();
      var markdown = $window.md(html),
        blob = new Blob([markdown], {type: 'text/markdown;charset=utf-8'});

      $window.saveAs(blob, 'meeting.md');
    }

    saverFactory.register('markdown', 'Save as markdown', generate);
  }])
  .directive('exportController', ['properties', 'saverFactory',
    function(properties, saverFactory) {
      function link(scope) {
        scope.savers = [];
        saverFactory.get().forEach(function(saver) {
          scope.savers.push({
            name: saver.name,
            tooltip: saver.tooltip,
            export: function() {
              saver.export(properties.quill);
            }
          });
        });
      }

      return {
        restrict: 'A',
        link: link
      };
    }
  ])
  .factory('collaborativeEditorDriver',['properties', '$rootScope', 'yjsService',
    'editorService', 'bindEditorService', '$log',
    function(properties, $rootScope, yjsService, editorService, bindEditorService, $log) {
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
        properties.quill = editorService();
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

    }
  ])
  .directive('liveConferenceEditorController', ['properties', 'INITIAL_PANE_SIZE', 'collaborativeEditorDriver',
    function(properties, INITIAL_PANE_SIZE, collaborativeEditorDriver) {
      function link(scope) {
        properties.editor_visible = false;
        properties.paneSize = INITIAL_PANE_SIZE;
        scope.properties = properties;
        scope.closeEditor = collaborativeEditorDriver.closeEditor;
        scope.toggleEditor = collaborativeEditorDriver.toggleEditor;
      }
    return {
      restrict: 'A',
      link: link
    };
    }])
  .directive('liveConferenceEditor', ['$rootScope', 'properties', function() {
    function controller($scope, $rootScope, properties) {
      $scope.colors = ['red', 'green', 'blue', 'yellow', 'black', 'white'];
      $scope.quill = false;

      function emitResizeWidth(event, args) {
        var paneWidth = 100 * args.width / $($window).width();
        $rootScope.$emit('paneSize', {width: paneWidth});
        return paneWidth;
      }

      $scope.$on('angular-resizable.resizing', emitResizeWidth);
      $scope.$on('angular-resizable.resizeEnd', function() {
        properties.paneSize.width = emitResizeWidth.apply(this, arguments);
      });
    }

    function link(scope, element) {
      scope.$on('editor:visible', function(evt, data) {
        element.css('width', data.paneSize.width + '%');
        element.addClass('visible');
      });
      scope.$on('editor:hidden', function(evt, data) {
        element.css('width', '0.1%');
        element.removeClass('visible');
      });
    }

    return {
      controller: controller,
      restrict: 'E',
      replace: 'true',
      link: link,
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
