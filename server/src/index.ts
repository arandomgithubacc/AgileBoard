import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import User from './models/User';
import authRoutes from './routes/authRoutes';
import taskRoutes from './routes/taskRoutes';

dotenv.config();

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Cấu hình Socket.io với CORS
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

// Middleware xử lý CORS và JSON 
app.use(cors());
app.use(express.json());

// Routes API
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);

// Socket.io Real-time Event
io.on('connection', (socket) => {
  socket.on('join_project', (projectId) => {
    socket.join(projectId);
  });

  // Khi có task được tạo/chuyển cột/sửa tên & mô tả
  socket.on('task_moved', (data) => {
    socket.to(data.projectId).emit('task_updated', data);
  });

  // Khi có task bị xóa
  socket.on('task_deleted_event', (data) => {
    socket.to(data.projectId).emit('task_deleted', data.taskId);
  });
});

// Kết nối MongoDB Cloud
const MONGO_URI = process.env.MONGO_URI || '';
const PORT = process.env.PORT || 5000;

mongoose
  .connect(MONGO_URI)
  .then(() => console.log('✅ Đã kết nối thành công tới MongoDB Atlas!'))
  .catch((err) => console.error('❌ Lỗi kết nối MongoDB:', err.message));

server.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại: http://localhost:${PORT}`);
});

// Lưu danh sách user online: { socketId, userId, username, avatar }
let onlineUsers: Array<{ socketId: string; userId: string; username: string; avatar?: string; projectId: string }> = [];

io.on('connection', (socket) => {
  // Khi user vào room
  socket.on('join_project', ({ projectId, user }) => {
    socket.join(projectId);

    // Thêm user vào danh sách online (nếu chưa có)
    if (user && !onlineUsers.some(u => u.socketId === socket.id)) {
      onlineUsers.push({
        socketId: socket.id,
        userId: user._id,
        username: user.username,
        avatar: user.avatar,
        projectId
      });
    }

    // Lọc danh sách online thuộc dự án này và phát cho mọi người trong room
    const projectOnlineUsers = onlineUsers.filter(u => u.projectId === projectId);
    io.to(projectId).emit('online_users_updated', projectOnlineUsers);
  });

  socket.on('task_moved', (data) => {
    socket.to(data.projectId).emit('task_updated', data);
  });

  socket.on('task_deleted_event', (data) => {
    socket.to(data.projectId).emit('task_deleted', data.taskId);
  });

  // Khi ngắt kết nối (tắt tab / reload)
  socket.on('disconnect', () => {
    const user = onlineUsers.find(u => u.socketId === socket.id);
    onlineUsers = onlineUsers.filter(u => u.socketId !== socket.id);
    
    if (user) {
      const projectOnlineUsers = onlineUsers.filter(u => u.projectId === user.projectId);
      io.to(user.projectId).emit('online_users_updated', projectOnlineUsers);
    }
  });
});

// 1. API lấy tất cả user đã đăng ký trong hệ thống
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}, '_id username email avatar');
    res.json(users);
  } catch (error) {
    console.error('Lỗi API GET /api/users:', error);
    res.status(500).json({ message: 'Lỗi lấy danh sách user' });
  }
});

// 2. API cập nhật thông tin cá nhân (Tên & Avatar Base64)
app.put('/api/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { username, avatar } = req.body;

    // Kiểm tra User ID hợp lệ
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'User ID không hợp lệ' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { username, avatar },
      { new: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    res.json(updatedUser);
  } catch (error) {
    console.error('Lỗi API PUT /api/users:', error);
    res.status(500).json({ message: 'Lỗi cập nhật profile' });
  }
});

app.put('/api/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { username, avatar } = req.body;

    console.log('>>> Request Update Profile cho UserId:', userId); // Debug ID gửi lên

    // Tránh lỗi nếu userId bị null/undefined hoặc chuỗi "undefined"
    if (!userId || userId === 'undefined' || userId === 'null') {
      return res.status(400).json({ message: 'User ID bị trống hoặc không hợp lệ' });
    }

    // Kiểm tra ObjectId hợp lệ của MongoDB
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: `User ID (${userId}) không đúng định dạng ObjectId` });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { username, avatar },
      { new: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    res.json(updatedUser);
  } catch (error) {
    console.error('Lỗi API PUT /api/users:', error);
    res.status(500).json({ message: 'Lỗi cập nhật profile' });
  }
});