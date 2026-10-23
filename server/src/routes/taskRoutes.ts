import { Router } from 'express';
import {
  getTasksByProject,
  createTask,
  updateTask,
  deleteTask,
} from '../controllers/taskController';

const router = Router();

router.get('/project/:projectId', getTasksByProject);
router.post('/', createTask);
router.put('/:taskId', updateTask);
router.delete('/:taskId', deleteTask);

export default router;