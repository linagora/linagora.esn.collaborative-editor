'use strict';

angular.module('collaborative-editor')
  .run(['$window', 'saverFactory', 'i18nService', function($window, saverFactory, i18nService) {
    function generate(editor) {
      var html = editor.getHTML();
      var markdown = $window.md(html),
        blob = new Blob([markdown], {type: 'text/markdown;charset=utf-8'});

      $window.saveAs(blob, 'meeting.md');
    }

    i18nService.__('Markdown').then(function(markdownString) {
      saverFactory.register(markdownString, generate, {faClass: 'fa-file-text-o'});
    });
  }]);
