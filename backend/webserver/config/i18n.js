'use strict';

module.exports = function(dependencies, application) {
  var i18n = require('../../../../../backend/i18n');
  application.use(i18n.init);
};
