'use strict';

angular.module('collaborative-editor')
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
            angular.extend(line, action.format);
            paragraphs[lastItem].text.push(line);

          } else if (action.action === NEWLINE) {
            paragraphs.push({text: []});

          } else if (action.action === FORMAT_PARAGRAPH) {
            angular.extend(paragraphs[lastItem], action.format);

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
  ]);
