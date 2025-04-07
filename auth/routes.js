const express = require('express');
const { register, login, getProfile } = require('./controllers');
const { authenticateToken } = require('./middleware');

const router = express.Router();

// Route đăng ký
router.post('/register', register);

// Route đăng nhập
router.post('/login', login);

// Route lấy thông tin người dùng (được bảo vệ)
router.get('/profile', authenticateToken, getProfile);

module.exports = router;
