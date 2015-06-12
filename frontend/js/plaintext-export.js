'use strict';

angular.module('collaborative-editor')
  .run(['$window', 'saverFactory', 'i18nService', function($window, saverFactory, i18nService) {
    function generate(editor) {
      var text = editor.getText();
      var blob = new Blob([text], {type: 'text/plain;charset=utf-8'});

      $window.saveAs(blob, 'meeting.txt');
    }
    i18nService.getCatalog().then(function(catalog) {
      saverFactory.register(catalog['Raw text'], generate, {faClass: 'fa-file-o'});
    });
  }]);
