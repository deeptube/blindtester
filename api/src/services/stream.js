const { existsSync, createReadStream } = require('fs');
const { NotFound, Unavailable } = require('@feathersjs/errors');
const { FILES_STORAGE_TYPE_FILESYSTEM, FILES_STORAGE_TYPE_BACKBLAZEB2 } = require('../../config/const');
const { getFiles } = require('../core/database');

module.exports = function (app) {
  // allow stream service to set response data
  app.use((req, res, next) => {
    req.feathers.res = res;
    next();
  });

  app.use('stream', {
    async get(id, { res }) {
      const file = (await getFiles()).find((file) => file.id === id);
      if (!file) {
        return new NotFound(`No file corresponding to "${id}"`);
      }

      if (file.storage.type === FILES_STORAGE_TYPE_FILESYSTEM) {
        if (!existsSync(file.storage.path)) {
          return new Unavailable('File is not available. Maybe it will soon, maybe not.');
        }

        res.set('Content-Type', 'audio/mpeg');
        createReadStream(file.storage.path).pipe(res);

        return;
      }

      if (file.storage.type === FILES_STORAGE_TYPE_BACKBLAZEB2) {
        res.redirect(301, file.storage.url);

        return;
      }
    },
  });
};
