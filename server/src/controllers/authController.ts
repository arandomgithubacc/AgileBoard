import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User';

// Đăng ký tài khoản
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({ message: 'Email này đã được sử dụng!' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      username,
      email,
      password: hashedPassword,
      role: username === 'administrator1' ? 'admin' : 'user',
    });

    res.status(201).json({ message: 'Tạo tài khoản thành công!', userId: newUser._id });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Đăng nhập
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      res.status(400).json({ message: 'Email hoặc mật khẩu không chính xác!' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password!);
    if (!isMatch) {
      res.status(400).json({ message: 'Email hoặc mật khẩu không chính xác!' });
      return;
    }

    if (user.username === 'administrator1' && user.role !== 'admin') {
      user.role = 'admin';
      await user.save();
    }

    const token = jwt.sign(
      { userId: user._id.toString(), username: user.username, role: user.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Lấy danh sách tất cả Users (để chọn Assignee)
export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await User.find({}, '_id username email avatar role');
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi lấy danh sách user' });
  }
};

export const createUser = async (req: Request, res: Response): Promise<void> => {
  const { username, email, password, role } = req.body;
  if (
    typeof username !== 'string' || !username.trim() ||
    typeof email !== 'string' || !email.trim() ||
    typeof password !== 'string' || !password ||
    (role !== 'user' && role !== 'admin')
  ) {
    res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin hợp lệ' });
    return;
  }

  try {
    const existingUser = await User.findOne({ email: email.trim() });
    if (existingUser) {
      res.status(409).json({ message: 'Email này đã được sử dụng!' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      username: username.trim(),
      email: email.trim(),
      password: hashedPassword,
      role,
    });

    res.status(201).json({
      _id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi tạo người dùng', error: error.message });
  }
};

export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  if (typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ message: 'User ID không hợp lệ' });
    return;
  }

  if (res.locals.authUserId === id) {
    res.status(403).json({ message: 'Admin không thể tự xóa tài khoản của mình' });
    return;
  }

  try {
    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ message: 'Không tìm thấy người dùng' });
      return;
    }
    if (user.role === 'admin') {
      res.status(403).json({ message: 'Không thể xóa tài khoản admin' });
      return;
    }

    await user.deleteOne();
    res.json({ message: 'Xóa người dùng thành công' });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi xóa người dùng', error: error.message });
  }
};

// Cập nhật Profile (Tên + Avatar)
export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { username, avatar } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { username, avatar },
      { new: true }
    ).select('-password');

    res.json(updatedUser);
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi cập nhật profile' });
  }
};