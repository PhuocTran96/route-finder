const jwt = require('jsonwebtoken');
const User = require('./models/User');

// Đăng ký người dùng mới
const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Kiểm tra người dùng đã tồn tại
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ 
        message: 'Đăng ký thất bại', 
        error: 'Email hoặc tên người dùng đã tồn tại' 
      });
    }
    
    // Tạo người dùng mới
    const user = new User({ username, email, password });
    await user.save();
    
    res.status(201).json({ 
      message: 'Đăng ký thành công',
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Đăng ký thất bại', 
      error: error.message 
    });
  }
};

// Đăng nhập
const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Tìm người dùng
    const user = await User.findOne({ 
      $or: [{ username }, { email: username }] 
    });
    
    if (!user) {
      return res.status(401).json({ 
        message: 'Đăng nhập thất bại', 
        error: 'Tên đăng nhập hoặc mật khẩu không đúng' 
      });
    }
    
    // Kiểm tra mật khẩu
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ 
        message: 'Đăng nhập thất bại', 
        error: 'Tên đăng nhập hoặc mật khẩu không đúng' 
      });
    }
    
    // Tạo JWT
    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '60m' }
    );
    
    res.status(200).json({
      message: 'Đăng nhập thành công',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Đăng nhập thất bại', 
      error: error.message 
    });
  }
};

// Lấy thông tin người dùng hiện tại
const getProfile = async (req, res) => {
  try {
    res.status(200).json({
      user: req.user
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Không thể lấy thông tin người dùng', 
      error: error.message 
    });
  }
};

// Đổi mật khẩu
const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    // Tìm người dùng hiện tại
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    // Kiểm tra mật khẩu cũ
    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Mật khẩu cũ không đúng' });
    }

    // Cập nhật mật khẩu mới
    user.password = newPassword;
    await user.save();

    res.status(200).json({ message: 'Đổi mật khẩu thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Reset password 123456
const resetPasswordToDefault = async (req, res) => {
  try {
    const { userId } = req.body;

    // Tìm người dùng theo ID
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    // Đặt lại mật khẩu về mặc định
    const defaultPassword = '123456';
    user.password = defaultPassword;
    await user.save();

    res.status(200).json({ message: 'Mật khẩu đã được đặt lại về mặc định' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

module.exports = {
  register,
  login,
  getProfile,
  changePassword,
  resetPasswordToDefault
};
