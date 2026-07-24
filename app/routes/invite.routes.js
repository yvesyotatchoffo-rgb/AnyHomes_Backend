const controller = require('../controllers/InviteController');

module.exports = (app) => {
  app.post('/api/invite/create', (req, res) => {
    const auth = require('../middleware/auth');
    auth(req, res, () => controller.create(req, res));
  });

  app.get('/api/invite/:token', (req, res) => controller.get(req, res));

  app.post('/api/invite/accept/:token', (req, res) => {
    const auth = require('../middleware/auth');
    auth(req, res, () => controller.accept(req, res));
  });
};
