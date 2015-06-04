'use strict';

angular.module('collaborative-editor')
  .run(['$window', 'saverFactory', function($window, saverFactory) {
    function generate(editor) {
      var text = editor.getText();
      var blob = new Blob([text], {type: 'text/plain;charset=utf-8'});

      $window.saveAs(blob, 'meeting.txt');
    }

    saverFactory.register('text', 'Save as raw text', generate);
  }]);
