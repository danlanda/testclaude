import { Router, Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';
import prisma from '../config/database.js';
import { authenticate, generateToken, AuthRequest } from '../middleware/auth.js';
import { createError } from '../middleware/errorHandler.js';

export const authRouter = Router();

const googleClient = new OAuth2Client();

// Validation schemas
const googleAuthSchema = z.object({
  googleToken: z.string()
});

// POST /api/auth/google - Authenticate with Google
authRouter.post('/google', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { googleToken } = googleAuthSchema.parse(req.body);

    // Verify the Google token
    let payload;
    try {
      // For Chrome extension, the token is an access token, not an ID token
      // We need to fetch user info from Google's userinfo endpoint
      const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: {
          Authorization: `Bearer ${googleToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to verify Google token');
      }

      payload = await response.json();
    } catch (error) {
      return next(createError('Invalid Google token', 401, 'INVALID_GOOGLE_TOKEN'));
    }

    if (!payload.email || !payload.sub) {
      return next(createError('Invalid Google token payload', 401, 'INVALID_PAYLOAD'));
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { googleId: payload.sub }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: payload.email,
          name: payload.name,
          picture: payload.picture,
          googleId: payload.sub
        }
      });
    } else {
      // Update user info if changed
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          name: payload.name,
          picture: payload.picture
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
        createdAt: true,
        _count: {
          select: {
            places: true,
            trips: true
          }
        }
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
