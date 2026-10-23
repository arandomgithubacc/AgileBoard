import { Router } from 'express';
import { deleteUser, getAllUsers } from '../controllers/authController';
import { requireAdmin } from '../middleware/adminMiddleware';

const router = Router();

router.get('/', getAllUsers);
router.delete('/:id', requireAdmin, deleteUser);

export default router;
