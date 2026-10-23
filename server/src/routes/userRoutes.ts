import { Router } from 'express';
import { createUser, deleteUser, getAllUsers } from '../controllers/authController';
import { requireAdmin } from '../middleware/adminMiddleware';

const router = Router();

router.get('/', getAllUsers);
router.post('/', requireAdmin, createUser);
router.delete('/:id', requireAdmin, deleteUser);

export default router;
