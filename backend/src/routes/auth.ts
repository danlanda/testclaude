import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../config/database.js';
import { authenticate, generateToken, AuthRequest } from '../middleware/auth.js';
import { createError } from '../middleware/errorHandler.js';

export const authRouter = Router();

// Validation schemas
const googleAuthSchema = z.object({
  googleToken: z.string()
});

interface GoogleUserInfo {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}

// POST /api/auth/google - Authenticate with Google
authRouter.post('/google', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { googleToken } = googleAuthSchema.parse(req.body);

    // Verify the Google token by fetching user info
    let userInfo: GoogleUserInfo;
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: {
          Authorization: `Bearer ${googleToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to verify Google token');
      }

      userInfo = await response.json() as GoogleUserInfo;
    } catch (error) {
      return next(createError('Invalid Google token', 401, 'INVALID_GOOGLE_TOKEN'));
    }

    if (!userInfo.email || !userInfo.sub) {
      return next(createError('Invalid Google token payload', 401, 'INVALID_PAYLOAD'));
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { googleId: userInfo.sub }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: userInfo.email,
          name: userInfo.name || null,
          picture: userInfo.picture || null,
          googleId: userInfo.sub
        }
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          name: userInfo.name || user.name,
          picture: userInfo.picture || user.picture
        }
      });
    }

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      name: user.name || undefined
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Invalid request body', 400, 'VALIDATION_ERROR'));
    }
    next(error);
  }
});

// GET /api/auth/verify - Verify JWT token
authRouter.get('/verify', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        name: true,
        picture: true
      }
    });

    if (!user) {
      return next(createError('User not found', 404, 'USER_NOT_FOUND'));
    }

    res.json({ valid: true, user });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me - Get current user
authRouter.get('/me', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        name: true,
        picture: true,
        createdAt: true
      }
    });

    if (!user) {
      return next(createError('User not found', 404, 'USER_NOT_FOUND'));
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/auth/account - Delete user account
authRouter.delete('/account', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.user.delete({
      where: { id: req.userId }
    });

    res.json({ success: true, message: 'Account deleted' });
  } catch (error) {
    next(error);
  }
});
