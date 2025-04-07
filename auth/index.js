const authRoutes = require('./routes');
const { authenticateToken } = require('./middleware');
const User = require('./models/User');

module.exports = {
  routes: authRoutes,
  middleware: { authenticateToken },
  models: { User }
};
