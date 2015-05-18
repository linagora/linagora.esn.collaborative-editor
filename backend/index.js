'use strict';

var AwesomeModule = require('awesome-module');
var Dependency = AwesomeModule.AwesomeModuleDependency;

var AwesomeYjsModule = new AwesomeModule('linagora.esn.text-editor', {
  dependencies: [
    new Dependency(Dependency.TYPE_NAME, 'webserver.wrapper', 'webserver-wrapper')
  ],
  states: {
    lib: function (dependencies, callback) {
      return callback(null, {});
    },
    deploy: function (dependencies, callback) {
      // register the webapp
      var app = require('./webserver/application')(dependencies);
      var webserver = dependencies('webserver-wrapper');

      webserver.injectAngularModules('yjs', ['app.js'], 'yjsEditor', ['live-conference']);
      webserver.injectCSS('yjs', ['editor.css'], ['live-conference']);

      // Inject extra dependencies
      var depList = {
        js: ["../quill/dist/quill.js", "yjs/y.js", "y-list/y-list.js",
          "y-selections/y-selections.js", "y-richtext/y-richtext.js"],
        css: ["quill/dist/quill.snow.css", "editor.css"]
      };
      webserver.injectJS('third_party', depList.js, ['live-conference'])
      webserver.injectCSS('third_party', depList.js, ['live-conference']);

      webserver.addApp('yjs', app);
      return callback(null, {});
    }
  },
  start: function (dependencies, callback) {
    callback();
  }
});

module.exports = AwesomeYjsModule;