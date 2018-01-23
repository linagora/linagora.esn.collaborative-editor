'use strict';

module.exports = function(config) {
  config.set({
    basePath: '../../',

    files: [
      'test/conf/phantom-bind-polyfill.js',
      'frontend/components/jquery/dist/jquery.js',
      'frontend/components/angular/angular.js',
      'frontend/components/angular-mocks/angular-mocks.js',
      'frontend/components/chai/chai.js',
      'frontend/components/chai-spies/chai-spies.js',
      'test/module.js',
      'src/**/*.js',
      'test/**/*.js',
      'frontend/js/**/*.js',
      'frontend/components/angular-resizable/angular-resizable.min.js',
      'frontend/components/awesome-yjs/frontend/js/angular-yjs.js',
      'frontend/components/quill/dist/quill.js',
      'frontend/components/ng-device-detector/ng-device-detector.js',
      'frontend/components/re-tree/re-tree.js',
      'frontend/components/angular-strap/dist/angular-strap.min.js',
      'frontend/views/**/*.pug'
    ],

    frameworks: ['mocha'],
    colors: true,
    singleRun: true,
    autoWatch: true,
    browsers: ['PhantomJS', 'Chrome', 'Firefox'],
    reporters: ['coverage', 'spec'],
    preprocessors: {
      'frontend/js/**/*.js': ['coverage'],
      'frontend/views/**/*.pug': ['ng-jade2module']

    },
    ngJade2ModulePreprocessor: {
      cacheIdFromPath: function(filepath) {
        var cacheId = '';

        if (filepath.match(/^frontend*/)) {
          cacheId = '/editor' + filepath.substr(8).replace('.pug', '.html');
        }

        return cacheId;
      },
      stripPrefix: 'frontend/',
      prependPrefix: '/editor/',

      // setting this option will create only a single module that contains templates
      // from all the files, so you can load them all with module('templates')
      moduleName: 'jadeTemplates'
    },
    plugins: [
      'karma-phantomjs-launcher',
      'karma-chrome-launcher',
      'karma-firefox-launcher',
      'karma-mocha',
      'karma-coverage',
      'karma-spec-reporter',
      '@linagora/karma-ng-jade2module-preprocessor'
    ],

    junitReporter: {
      outputFile: 'test_out/unit.xml',
      suite: 'unit-frontend'
    },

    coverageReporter: {type: 'text', dir: '/tmp'}
  });
};
