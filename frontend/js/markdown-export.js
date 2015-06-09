'use strict';

angular.module('collaborative-editor')
  .run(['$window', 'saverFactory', function($window, saverFactory) {
    function generate(editor) {
      var html = editor.getHTML();
      var markdown = $window.md(html),
        blob = new Blob([markdown], {type: 'text/markdown;charset=utf-8'});

      $window.saveAs(blob, 'meeting.md');
    }

    saverFactory.register('markdown', 'Save as markdown', generate);
  }]);
