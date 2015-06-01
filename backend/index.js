'use strict';

var AwesomeModule = require('awesome-module');
var Dependency = AwesomeModule.AwesomeModuleDependency;

var AwesomeYjsModule = new AwesomeModule('linagora.esn.text-editor', {
  dependencies: [
    new Dependency(Dependency.TYPE_NAME, 'webserver.wrapper', 'webserver-wrapper'),
    new Dependency(Dependency.TYPE_NAME, 'linagora.esn.yjs', 'yjs')
  ],
  states: {
    lib: function(dependencies, callback) {
      return callback(null, {});
    },
    deploy: function(dependencies, callback) {
      // register the webapp
      var depList;
      var app = require('./webserver/application')(dependencies);
      var webserver = dependencies('webserver-wrapper');

      webserver.injectAngularModules('editor', ['app.js'], 'collaborative-editor', ['live-conference']);
      webserver.injectCSS('editor', ['editor.css'], ['live-conference']);

      // Inject extra dependencies
      depList = {
        js: ['../components/quill/dist/quill.js',
          '../components/html-md/dist/md.min.js',
          '../components/file-saver.js/FileSaver.js',
          '../components/pdfmake/build/pdfmake.js',
          '../components/pdfmake/build/vfs_fonts.js'
        ],
        css: ['editor.css', '../components/quill/dist/quill.snow.css']
      };

      webserver.injectJS('editor', depList.js, ['live-conference']);
      webserver.injectCSS('editor', depList.css, ['live-conference']);

      webserver.addApp('editor', app);
      return callback(null, {});
    }
  },
  start: function(dependencies, callback) {
    callback();
  }
});

module.exports = AwesomeYjsModule;
