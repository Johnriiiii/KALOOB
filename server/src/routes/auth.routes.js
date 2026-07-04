import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { User } from '../models/user.model.js';
import { createToken } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/login', async (request, response, next) => {
  try {
    const { username, password } = request.body ?? {};
    const normalizedUsername = String(username ?? '').toLowerCase();
    const user = await User.findOne({ username: normalizedUsername, active: true });
    if (!user) {
      return response.status(401).json({ message: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return response.status(401).json({ message: 'Invalid credentials' });
    }

    const payload = {
      id: user._id.toString(),
      role: user.role,
      label: user.label,
      churchId: user.churchId,
    };

    const token = createToken(payload);
    return response.json({ token, user: payload });
  } catch (error) {
    next(error);
  }
});

export default router;
