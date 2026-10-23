import { Request, Response } from 'express';
import Task from '../models/Task';

export const getTasksByProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    const tasks = await Task.find({ projectId });
    res.json(tasks);
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi lấy danh sách Task', error: error.message });
  }
};

export const createTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, description, status, priority, deadline, projectId } = req.body;
    const newTask = new Task({ title, description, status, priority, deadline, projectId });
    await newTask.save();
    res.status(201).json(newTask);
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi tạo Task', error: error.message });
  }
};

export const updateTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const { taskId } = req.params;
    const updatedTask = await Task.findByIdAndUpdate(
      taskId,
      req.body,
      { new: true }
    );
    res.json(updatedTask);
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi cập nhật Task', error: error.message });
  }
};

export const deleteTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const { taskId } = req.params;
    await Task.findByIdAndDelete(taskId);
    res.json({ message: 'Xóa Task thành công' });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi xóa Task', error: error.message });
  }
};