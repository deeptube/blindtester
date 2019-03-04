const config = require('../../config');

module.exports = (app) => {
  if (config.endpoint.save.enabled) {
    app.configure(require('./save'));
  }

  if (config.endpoint.stream.enabled) {
    app.configure(require('./stream'));
  }

  if (config.endpoint.slack.enabled) {
    app.configure(require('./slack'));
  }
};
