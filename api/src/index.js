const app = require('./app');

app.listen(app.get('port'));

// eslint-disable-next-line no-console
console.log(`listening on port ${app.get('port')}`);
