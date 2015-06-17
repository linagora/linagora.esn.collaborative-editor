'use strict';

angular.module('collaborative-editor')
  .constant('INITIAL_PANE_SIZE', {
    width: 70,
    height: 100
  })
  .constant('QUILL_TO_PDFMAKE_STYLE_EQUIVALENCE', {
    formats: {
      'bold': 'bold',
      'underline': 'underline',
      'italic': 'italics',
      'size': 'fontSize',
      'align': 'alignment',
      'bullet': 'bullet',
      'list': 'list',
      'color': 'color',
      'background': 'background'
    },
    decoration: {
      'strike': 'lineThrough',
      'underline': 'underline'
    }
  })
  .constant('DEBUG_MESSAGE', {
    'ask_for_content': 'collaborative-editor:debug:ask for content',
    'get_content': 'collaborative-editor:debug:get content'
  });
