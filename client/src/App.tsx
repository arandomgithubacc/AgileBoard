import React, { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { io } from 'socket.io-client';
import axios from 'axios';
import { Plus, LogOut, Trash2, Edit3, X, AlertCircle, Settings, Users } from 'lucide-react';

const socket = io('http://localhost:5000');
const PROJECT_ID = '65f1234567890123456789ab';

interface UserType {
  _id: string;
  username: string;
  email: string;
  avatar?: string;
  role: 'user' | 'admin';
}

interface Task {
  _id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in-progress' | 'done';
  priority?: 'high' | 'medium' | 'low';
  deadline?: string;
  assigneeId?: string;
}

const COLUMNS = [
  { id: 'todo', title: '📋 To Do (Cần làm)' },
  { id: 'in-progress', title: '⚡ In Progress (Đang làm)' },
  { id: 'done', title: '✅ Done (Đã xong)' }
];

// Component hiển thị Avatar (Hình ảnh hoặc Chữ cái đầu)
const UserAvatar = ({ username, avatar, size = 'w-7 h-7 text-xs' }: { username: string; avatar?: string; size?: string }) => {
  if (avatar && avatar.trim() !== '') {
    return (
      <img
        src={avatar}
        alt={username}
        className={`${size} rounded-full object-cover border border-white shadow-xs`}
        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
      />
    );
  }

  const firstLetter = username ? username.charAt(0).toUpperCase() : '?';
  const colors = ['bg-blue-500', 'bg-purple-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500'];
  const charCode = username ? username.charCodeAt(0) : 0;
  const bgColor = colors[charCode % colors.length];

  return (
    <div className={`${size} ${bgColor} text-white font-bold rounded-full flex items-center justify-center border border-white shadow-xs`}>
      {firstLetter}
    </div>
  );
};

export default function App() {
  // Auth State
  const [currentUser, setCurrentUser] = useState<UserType | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '' });
  const [authError, setAuthError] = useState('');

  // App States
  const [tasks, setTasks] = useState<Task[]>([]);
  const [allUsers, setAllUsers] = useState<UserType[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Array<{ userId: string; username: string; avatar?: string }>>([]);

  // Form Task State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'high' | 'medium' | 'low' | ''>('');
  const [newTaskDeadline, setNewTaskDeadline] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');

  // Modals State
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isUsersModalOpen, setIsUsersModalOpen] = useState(false);
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    username: '',
    email: '',
    password: '',
    role: 'user' as 'user' | 'admin',
  });
  const [profileForm, setProfileForm] = useState({ username: '', avatar: '' });

  // Fetch Data & Socket Setup
  useEffect(() => {
    if (!currentUser) return;

    // 1. Lấy danh sách tất cả Users trong hệ thống
    axios.get('http://localhost:5000/api/users')
      .then(res => setAllUsers(res.data))
      .catch(err => console.error('Lỗi lấy danh sách user:', err));

    // 2. Lấy danh sách Task của Project
    axios.get(`http://localhost:5000/api/tasks/project/${PROJECT_ID}`)
      .then(res => setTasks(res.data))
      .catch(err => console.error('Lỗi lấy danh sách task:', err));

    // Socket Join Project Room
    socket.emit('join_project', { projectId: PROJECT_ID, user: currentUser });

    // Lắng nghe danh sách Online
    socket.on('online_users_updated', (users) => {
      setOnlineUsers(users);
    });

    // Lắng nghe thay đổi Task
    socket.on('task_updated', (updatedTask: Task) => {
      setTasks(prev => {
        const exists = prev.some(t => t._id === updatedTask._id);
        return exists ? prev.map(t => t._id === updatedTask._id ? updatedTask : t) : [...prev, updatedTask];
      });
    });

    socket.on('task_deleted', (deletedId: string) => {
      setTasks(prev => prev.filter(t => t._id !== deletedId));
    });

    return () => {
      socket.off('online_users_updated');
      socket.off('task_updated');
      socket.off('task_deleted');
    };
  }, [currentUser]);

  // Hàm chọn file & Tự động nén ảnh xuống kích thước nhỏ (Max 200x200)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        // Tạo Canvas để vẽ lại ảnh với kích thước chuẩn Avatar
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 200;
        const MAX_HEIGHT = 200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        // Xuất ra chuỗi Base64 đã nén (chỉ nặng vài KB)
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
        setProfileForm(prev => ({ ...prev, avatar: compressedBase64 }));
      };
    };
  };

  // Cập nhật Profile
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Lấy ID chuẩn (hỗ trợ cả _id hoặc id)
    const userId = currentUser?._id || (currentUser as any)?.id;

    if (!userId) {
      alert('Không tìm thấy thông tin ID người dùng! Vui lòng đăng xuất và đăng nhập lại.');
      return;
    }

    try {
      const res = await axios.put(`http://localhost:5000/api/users/${userId}`, profileForm);
      const updated = res.data;

      // Cập nhật State & LocalStorage
      setCurrentUser(updated);
      localStorage.setItem('user', JSON.stringify(updated));

      // Cập nhật lại danh sách Users ở Frontend
      setAllUsers(prev => prev.map(u => (u._id === updated._id || (u as any).id === updated._id) ? updated : u));

      setIsProfileModalOpen(false);
      alert('Cập nhật thông tin thành công!');
    } catch (err: any) {
      console.error('Lỗi chi tiết:', err);
      alert(err.response?.data?.message || 'Lỗi cập nhật profile');
    }
  };
  
  // Auth Handlers
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const endpoint = isRegisterMode ? '/api/auth/register' : '/api/auth/login';

    try {
      const res = await axios.post(`http://localhost:5000${endpoint}`, authForm);
      if (isRegisterMode) {
        alert('Đăng ký thành công! Hãy đăng nhập.');
        setIsRegisterMode(false);
      } else {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        setCurrentUser(res.data.user);
      }
    } catch (err: any) {
      setAuthError(err.response?.data?.message || 'Lỗi xác thực');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setCurrentUser(null);
  };

  const handleOpenUsers = async () => {
    setIsUsersModalOpen(true);
    setIsUsersLoading(true);
    setUsersError('');
    try {
      const res = await axios.get('http://localhost:5000/api/users');
      setAllUsers(res.data);
    } catch (err: any) {
      setUsersError(err.response?.data?.message || 'Lỗi lấy danh sách người dùng');
    } finally {
      setIsUsersLoading(false);
    }
  };

  const handleDeleteUser = async (user: UserType) => {
    if (!window.confirm(`Bạn có chắc muốn xóa tài khoản "${user.username}"?`)) return;

    setUsersError('');
    try {
      await axios.delete(`http://localhost:5000/api/users/${user._id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      });
      setAllUsers(prev => prev.filter(existing => existing._id !== user._id));
    } catch (err: any) {
      setUsersError(err.response?.data?.message || 'Lỗi xóa người dùng');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUsersError('');

    if (
      !newUserForm.username.trim() ||
      !newUserForm.email.trim() ||
      !newUserForm.password
    ) {
      setUsersError('Vui lòng nhập đầy đủ tên đăng nhập, email và mật khẩu.');
      return;
    }

    if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.com$/i.test(newUserForm.email.trim())) {
      setUsersError('Email phải có định dạng xxx@yyy.com.');
      return;
    }

    setIsCreatingUser(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setUsersError('Phiên đăng nhập không có token. Vui lòng đăng xuất rồi đăng nhập lại.');
        return;
      }

      const res = await axios.post('http://localhost:5000/api/users', newUserForm, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAllUsers(prev => [...prev, res.data]);
      setNewUserForm({ username: '', email: '', password: '', role: 'user' });
      setIsCreateUserOpen(false);
    } catch (err: any) {
      setUsersError(err.response?.data?.message || 'Lỗi tạo người dùng');
    } finally {
      setIsCreatingUser(false);
    }
  };

  // Tạo Task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    try {
      const res = await axios.post('http://localhost:5000/api/tasks', {
        title: newTaskTitle,
        description: newTaskDesc,
        status: 'todo',
        priority: newTaskPriority || undefined,
        deadline: newTaskDeadline || undefined,
        assigneeId: newTaskAssignee || undefined,
        projectId: PROJECT_ID
      });

      setTasks(prev => [...prev, res.data]);
      socket.emit('task_moved', { projectId: PROJECT_ID, ...res.data });

      setNewTaskTitle('');
      setNewTaskDesc('');
      setNewTaskPriority('');
      setNewTaskDeadline('');
      setNewTaskAssignee('');
    } catch (err) {
      console.error(err);
    }
  };

  // Kéo thả Task
  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newStatus = destination.droppableId as any;
    const target = tasks.find(t => t._id === draggableId);
    if (!target) return;

    setTasks(prev => prev.map(t => t._id === draggableId ? { ...t, status: newStatus } : t));

    try {
      const res = await axios.put(`http://localhost:5000/api/tasks/${draggableId}`, { status: newStatus });
      socket.emit('task_moved', { projectId: PROJECT_ID, ...res.data });
    } catch (err) {
      setTasks(prev => prev.map(t => t._id === draggableId ? target : t));
    }
  };

  // Sửa Task Details
  const handleUpdateTaskDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;

    try {
      const res = await axios.put(`http://localhost:5000/api/tasks/${editingTask._id}`, editingTask);
      setTasks(prev => prev.map(t => t._id === res.data._id ? res.data : t));
      socket.emit('task_moved', { projectId: PROJECT_ID, ...res.data });
      setEditingTask(null);
    } catch (err) {
      console.error(err);
    }
  };

  // Xóa Task
  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('Xóa task này?')) return;
    try {
      await axios.delete(`http://localhost:5000/api/tasks/${taskId}`);
      setTasks(prev => prev.filter(t => t._id !== taskId));
      socket.emit('task_deleted_event', { projectId: PROJECT_ID, taskId });
      setEditingTask(null);
    } catch (err) {
      console.error(err);
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high': return 'bg-red-50/80 border-red-200';
      case 'medium': return 'bg-yellow-50/80 border-yellow-200';
      case 'low': return 'bg-emerald-50/80 border-emerald-200';
      default: return 'bg-white border-slate-200';
    }
  };

  // Render Form Đăng nhập / Đăng ký
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md">
          <h2 className="text-2xl font-bold text-center mb-6 text-slate-800">
            {isRegisterMode ? 'Đăng Ký Tài Khoản' : 'Đăng Nhập'}
          </h2>
          {authError && <div className="text-red-500 text-sm mb-4 text-center">{authError}</div>}
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {isRegisterMode && (
              <input
                type="text"
                placeholder="Username"
                required
                value={authForm.username}
                onChange={e => setAuthForm({ ...authForm, username: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-500"
              />
            )}
            <input
              type="email"
              placeholder="Email"
              required
              value={authForm.email}
              onChange={e => setAuthForm({ ...authForm, email: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-500"
            />
            <input
              type="password"
              placeholder="Mật khẩu"
              required
              value={authForm.password}
              onChange={e => setAuthForm({ ...authForm, password: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg font-medium cursor-pointer transition-colors">
              {isRegisterMode ? 'Tạo tài khoản' : 'Đăng nhập'}
            </button>
          </form>
          <p className="text-xs text-center mt-4 text-slate-500">
            <button onClick={() => setIsRegisterMode(!isRegisterMode)} className="text-purple-600 underline cursor-pointer">
              {isRegisterMode ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Đăng ký ngay'}
            </button>
          </p>
        </div>
      </div>
    );
  }

  const total = tasks.length;
  const todoCount = tasks.filter(task => task.status === 'todo').length;
  const inProgressCount = tasks.filter(task => task.status === 'in-progress').length;
  const doneCount = tasks.filter(task => task.status === 'done').length;
  const completionRate = Math.round((doneCount / total) * 100) || 0;

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      {/* Header */}
      <header className="max-w-6xl mx-auto mb-6 bg-white p-4 rounded-xl shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <UserAvatar username={currentUser.username} avatar={currentUser.avatar} size="w-10 h-10 text-base" />
          <div>
            <h1 className="text-xl font-bold text-slate-800">AgileBoard Real-time</h1>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              Xin chào, <strong className="text-purple-600">{currentUser.username}</strong>
              <button 
                onClick={() => {
                  setProfileForm({ username: currentUser.username, avatar: currentUser.avatar || '' });
                  setIsProfileModalOpen(true);
                }}
                className="text-slate-400 hover:text-purple-600 ml-1 p-0.5 cursor-pointer"
                title="Cập nhật Profile"
              >
                <Settings size={14} />
              </button>
            </p>
          </div>
        </div>

        {/* Users Online List */}
        <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
          <span className="text-xs font-semibold text-slate-500">Online ({onlineUsers.length}):</span>
          <div className="flex -space-x-2">
            {onlineUsers.map((u, i) => (
              <div key={i} className="relative group" title={`${u.username} (Online)`}>
                <UserAvatar username={u.username} avatar={u.avatar} size="w-8 h-8 text-xs" />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full"></span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {currentUser.role === 'admin' && (
            <button
              onClick={handleOpenUsers}
              className="flex items-center gap-2 px-3 py-2 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg text-sm font-medium cursor-pointer transition-colors"
            >
              <Users size={16} /> Quản lý Users
            </button>
          )}
          <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-600 rounded-lg cursor-pointer transition-colors" title="Đăng xuất">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Form Tạo Task */}
      <div className="max-w-6xl mx-auto mb-8 bg-white p-4 rounded-xl shadow-sm border border-slate-200/60">
        <form onSubmit={handleCreateTask} className="space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            <input
              type="text"
              placeholder="Tên công việc (*)..."
              required
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg md:w-1/3 text-sm outline-none focus:ring-2 focus:ring-purple-500"
            />
            <input
              type="text"
              placeholder="Mô tả công việc..."
              value={newTaskDesc}
              onChange={(e) => setNewTaskDesc(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg flex-1 text-sm outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="flex flex-wrap gap-3 items-center justify-between pt-1">
            <div className="flex flex-wrap gap-2 text-xs">
              <select
                value={newTaskPriority}
                onChange={(e) => setNewTaskPriority(e.target.value as any)}
                className="px-3 py-2 border border-slate-300 rounded-lg bg-white outline-none"
              >
                <option value="">-- Mức độ --</option>
                <option value="high">🔴 Cao</option>
                <option value="medium">🟡 Trung bình</option>
                <option value="low">🟢 Thấp</option>
              </select>

              {/* Dropdown Người Thực Hiện từ Danh Sách Users trong DB */}
              <select
                value={newTaskAssignee}
                onChange={(e) => setNewTaskAssignee(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg bg-white outline-none"
              >
                <option value="">-- Người thực hiện --</option>
                {allUsers.map(u => (
                  <option key={u._id} value={u._id}>👤 {u.username}</option>
                ))}
              </select>

              <input
                type="datetime-local"
                value={newTaskDeadline}
                onChange={(e) => setNewTaskDeadline(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg outline-none"
              />
            </div>

            <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-lg text-sm font-medium flex items-center gap-1 cursor-pointer transition-colors">
              <Plus size={16} /> Thêm Task
            </button>
          </div>
        </form>
      </div>

      {/* Agile Progress */}
      <section
        aria-label="Thống kê tiến độ công việc"
        className="max-w-6xl mx-auto mb-6 rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-800">Agile Progress</h2>
          <span className="text-sm font-bold text-emerald-700">{completionRate}% hoàn thành</span>
        </div>
        <div
          role="progressbar"
          aria-label="Tỷ lệ hoàn thành"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={completionRate}
          className="mb-4 h-2.5 overflow-hidden rounded-full bg-emerald-100"
        >
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${completionRate}%` }}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
            <span className="text-xs font-medium text-slate-600">Tổng task</span>
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-700">{total}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-sky-50 px-3 py-2">
            <span className="text-xs font-medium text-sky-700">To Do</span>
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-700">{todoCount}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2">
            <span className="text-xs font-medium text-amber-700">In Progress</span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">{inProgressCount}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2">
            <span className="text-xs font-medium text-emerald-700">Done</span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">{doneCount}</span>
          </div>
        </div>
      </section>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {COLUMNS.map(col => {
            const colTasks = tasks.filter(t => t.status === col.id);

            return (
              <div key={col.id} className="bg-slate-200/70 p-4 rounded-xl flex flex-col min-h-[500px]">
                <h2 className="font-semibold text-slate-700 mb-4 flex justify-between items-center text-sm">
                  <span>{col.title}</span>
                  <span className="bg-slate-300 text-xs px-2 py-0.5 rounded-full font-bold">{colTasks.length}</span>
                </h2>

                <Droppable droppableId={col.id}>
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="flex-1 flex flex-col gap-3">
                      {colTasks.map((task, index) => {
                        const assigneeUser = allUsers.find(u => u._id === task.assigneeId);

                        return (
                          <Draggable key={task._id} draggableId={task._id} index={index}>
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                onClick={() => setEditingTask(task)}
                                className={`p-4 rounded-lg shadow-xs border relative cursor-pointer hover:shadow-md transition-shadow ${getPriorityColor(task.priority)}`}
                              >
                                <div className="flex justify-between items-start mb-1">
                                  <h3 className="font-semibold text-slate-800 text-sm pr-6">{task.title}</h3>
                                  <Edit3 size={14} className="text-slate-400 absolute top-4 right-4" />
                                </div>

                                {task.deadline && (
                                  <div className="text-[10px] font-medium text-rose-600 my-1 flex items-center gap-1">
                                    <AlertCircle size={11} />
                                    <span>Hạn: {new Date(task.deadline).toLocaleString('vi-VN')}</span>
                                  </div>
                                )}

                                {task.description && (
                                  <p className="text-xs text-slate-600 mt-1 line-clamp-2 bg-white/50 p-1.5 rounded">
                                    {task.description}
                                  </p>
                                )}

                                {/* Assignee Avatar ở góc dưới */}
                                <div className="mt-3 flex justify-end items-center">
                                  {assigneeUser ? (
                                    <div className="flex items-center gap-1.5" title={`Người làm: ${assigneeUser.username}`}>
                                      <span className="text-[10px] text-slate-500 font-medium">{assigneeUser.username}</span>
                                      <UserAvatar username={assigneeUser.username} avatar={assigneeUser.avatar} size="w-6 h-6 text-[10px]" />
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-slate-400 italic">Chưa giao</span>
                                  )}
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {isUsersModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 relative">
            <button
              type="button"
              onClick={() => setIsUsersModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
              aria-label="Đóng"
            >
              <X size={18} />
            </button>
            <h3 className="text-lg font-bold mb-4 text-slate-800">Quản lý Users</h3>
            {usersError && <p className="text-sm text-red-600 mb-3">{usersError}</p>}
            {!isCreateUserOpen ? (
              <button
                type="button"
                onClick={() => {
                  setUsersError('');
                  setIsCreateUserOpen(true);
                }}
                className="mb-4 flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700 cursor-pointer"
              >
                <Plus size={16} /> Thêm User mới
              </button>
            ) : (
              <form onSubmit={handleCreateUser} className="mb-5 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                <input
                  type="text"
                  placeholder="Tên đăng nhập"
                  required
                  minLength={3}
                  value={newUserForm.username}
                  onChange={e => setNewUserForm(prev => ({ ...prev, username: e.target.value }))}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                />
                <input
                  type="email"
                  placeholder="Email"
                  required
                  minLength={6}
                  value={newUserForm.email}
                  onChange={e => setNewUserForm(prev => ({ ...prev, email: e.target.value }))}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                />
                <input
                  type="password"
                  placeholder="Mật khẩu"
                  required
                  minLength={8}
                  value={newUserForm.password}
                  onChange={e => setNewUserForm(prev => ({ ...prev, password: e.target.value }))}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                />
                <select
                  value={newUserForm.role}
                  onChange={e => setNewUserForm(prev => ({ ...prev, role: e.target.value as 'user' | 'admin' }))}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
                <div className="flex justify-end gap-2 sm:col-span-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateUserOpen(false)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-white cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingUser}
                    className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 cursor-pointer"
                  >
                    {isCreatingUser ? 'Đang tạo...' : 'Xác nhận'}
                  </button>
                </div>
              </form>
            )}
            {isUsersLoading ? (
              <p className="text-sm text-slate-500">Đang tải danh sách...</p>
            ) : (
              <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
                {allUsers.map(user => (
                  <div key={user._id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-slate-800 truncate">{user.username}</p>
                      <p className="text-xs text-slate-500 truncate">{user.email}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className={`text-xs font-medium ${user.role === 'admin' ? 'text-purple-700' : 'text-slate-500'}`}>
                        {user.role === 'admin' ? 'Admin' : 'User'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteUser(user)}
                        disabled={user.role === 'admin' || user._id === currentUser._id}
                        className="flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                        title={user.role === 'admin' ? 'Không thể xóa admin' : undefined}
                      >
                        <Trash2 size={13} /> Xóa
                      </button>
                    </div>
                  </div>
                ))}
                {allUsers.length === 0 && <p className="py-4 text-center text-sm text-slate-500">Chưa có người dùng nào.</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL CẬP NHẬT PROFILE */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 relative">
            <button 
              type="button" 
              onClick={() => setIsProfileModalOpen(false)} 
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X size={18} />
            </button>
            
            <h3 className="text-base font-bold mb-4 text-slate-800">Cập nhật thông tin cá nhân</h3>
            
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-600 mb-1 font-medium">Tên hiển thị</label>
                <input
                  type="text"
                  required
                  value={profileForm.username}
                  onChange={e => setProfileForm({ ...profileForm, username: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1 font-medium">Chọn ảnh đại diện từ máy</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 cursor-pointer"
                />
                
                {/* Preview ảnh đại diện */}
                {profileForm.avatar && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">Xem trước:</span>
                    <img src={profileForm.avatar} alt="Preview" className="w-10 h-10 rounded-full object-cover border" />
                    <button
                      type="button"
                      onClick={() => setProfileForm({ ...profileForm, avatar: '' })}
                      className="text-[11px] text-red-500 underline cursor-pointer"
                    >
                      Xóa ảnh
                    </button>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 text-xs rounded-lg font-medium cursor-pointer transition-colors"
                >
                  Lưu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDIT TASK */}
      {editingTask && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 relative">
            <button onClick={() => setEditingTask(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
            <h3 className="text-lg font-bold mb-4 text-slate-800">Chỉnh sửa Task</h3>
            <form onSubmit={handleUpdateTaskDetails} className="space-y-3">
              <input
                type="text"
                required
                value={editingTask.title}
                onChange={e => setEditingTask({ ...editingTask, title: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-500"
              />
              
              <div className="grid grid-cols-2 gap-2 text-xs">
                <select
                  value={editingTask.priority || ''}
                  onChange={e => setEditingTask({ ...editingTask, priority: e.target.value as any })}
                  className="p-2 border border-slate-300 rounded-lg outline-none"
                >
                  <option value="">Default Priority</option>
                  <option value="high">🔴 Cao</option>
                  <option value="medium">🟡 Trung bình</option>
                  <option value="low">🟢 Thấp</option>
                </select>

                <select
                  value={editingTask.assigneeId || ''}
                  onChange={e => setEditingTask({ ...editingTask, assigneeId: e.target.value })}
                  className="p-2 border border-slate-300 rounded-lg outline-none"
                >
                  <option value="">-- Người thực hiện --</option>
                  {allUsers.map(u => (
                    <option key={u._id} value={u._id}>👤 {u.username}</option>
                  ))}
                </select>
              </div>

              <textarea
                rows={3}
                placeholder="Mô tả công việc..."
                value={editingTask.description || ''}
                onChange={e => setEditingTask({ ...editingTask, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-500"
              />

              <div className="flex justify-between pt-2">
                <button 
                  type="button" 
                  onClick={() => handleDeleteTask(editingTask._id)} 
                  className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Trash2 size={14} /> Xóa Task
                </button>
                <button 
                  type="submit" 
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}