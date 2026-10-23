import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import User from '../models/User';

export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Vui lòng đăng nhập' });
    return;
  }

  let payload: JwtPayload;
  try {
    const decoded = jwt.verify(
      authorization.slice('Bearer '.length),
      process.env.JWT_SECRET || 'secret'
    );
    if (typeof decoded === 'string' || typeof decoded.userId !== 'string') {
      res.status(401).json({ message: 'Token không hợp lệ' });
      return;
    }
    payload = decoded;
  } catch {
    res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
    return;
  }

  const user = await User.findById(payload.userId).select('_id role');
  if (!user) {
    res.status(401).json({ message: 'Tài khoản không tồn tại' });
    return;
  }
  if (user.role !== 'admin') {
    res.status(403).json({ message: 'Chỉ admin mới có quyền thực hiện thao tác này' });
    return;
  }

  res.locals.authUserId = user._id.toString();
  next();
};
