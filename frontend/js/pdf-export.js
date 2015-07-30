'use strict';

/**
  * The tricky part here is to translate quill's output (see @link{https://atom.io/packages/fold-functions})
  * into pdfmake (see @link{https://atom.io/packages/fold-functions}) input. To do that, we iterate over each
  * deltas. A line is made of multiple delta and separated by a '\n'. The attributes and the decorations
  * are parsed using the constant map given in QUILL_TO_PDFMAKE_STYLE_EQUIVALENCE.
  **/
angular.module('collaborative-editor')
  .run(['QUILL_TO_PDFMAKE_STYLE_EQUIVALENCE', '$window', 'saverFactory', 'i18nService',
    function(QUILL_TO_PDFMAKE_STYLE_EQUIVALENCE, $window, saverFactory, i18nService) {
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
          var value;
          var processedAttributes = {};
          for (var key in attributes) {
            value = attributes[key];
            if (key in QUILL_TO_PDFMAKE_STYLE_EQUIVALENCE.formats) {
              processedAttributes[QUILL_TO_PDFMAKE_STYLE_EQUIVALENCE.formats[key]] = valueMiddleWare(key, value);
            }
          }
          return processedAttributes;
        }
        function decorationAttributes(attributes) {
          var value, decorations;
          for (var key in attributes) {
            value = attributes[key];
            if (key in QUILL_TO_PDFMAKE_STYLE_EQUIVALENCE.decoration) {
              decorations = QUILL_TO_PDFMAKE_STYLE_EQUIVALENCE.decoration[key];
            }
          }
          return decorations;
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
                format: formatAttributes(delta.attributes || []),
                decoration: decorationAttributes(delta.attributes || [])
              });
              processLater.push({action: NEWLINE});
              // +1 to skip the '\n'
              from += lineLength + 1;
              lineLength = delta.insert.substr(from).indexOf('\n');

            } else if (lineLength === 0) {
              processLater.push({
                action: FORMAT_PARAGRAPH,
                format: formatAttributes(delta.attributes || []),
                decoration: decorationAttributes(delta.attributes || [])
              });
              processLater.push({action: NEWLINE});
              from += 1;
              lineLength = delta.insert.substr(from).indexOf('\n');

            } else {
              processLater.push({
                action: INSERT,
                content: delta.insert.substr(from),
                format: formatAttributes(delta.attributes || []),
                decoration: decorationAttributes(delta.attributes || [])
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
            line.decoration = action.decoration;
            paragraphs[lastItem].text.push(line);

          } else if (action.action === NEWLINE) {
            paragraphs.push({text: []});

          } else if (action.action === FORMAT_PARAGRAPH) {
            angular.extend(paragraphs[lastItem], action.format);
            paragraphs[lastItem].decoration = action.decoration;

            if ('bullet' in action.format) {
              paragraphs[lastItem].ul = paragraphs[lastItem].text;
              delete paragraphs[lastItem].text;

            } else if ('list' in action.format) {
              paragraphs[lastItem].ol = paragraphs[lastItem].text;
              delete paragraphs[lastItem].text;
            }
          }
        });

        $window.pdfMake.createPdf({content: paragraphs}).download('meeting.pdf');
      }

      i18nService.__('PDF').then(function(pdfString) {
        saverFactory.register(pdfString, generate, {
          faClass: 'fa-file-pdf-o',
          default: true
        });
      });
    }
  ]);
