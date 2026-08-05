const { AsyncLocalStorage } = require("async_hooks");

const storage = new AsyncLocalStorage();

function runWithEmailContext(ctx, fn) {
  return storage.run(ctx || {}, fn);
}

function getEmailContext() {
  return storage.getStore() || {};
}

module.exports = {
  runWithEmailContext,
  getEmailContext,
};
