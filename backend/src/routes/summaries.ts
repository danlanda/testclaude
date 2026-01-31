import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../config/database.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { createError } from '../middleware/errorHandler.js';

interface SummaryRecord {
  id: string;
  title: string;
  url: string;
  summary: string;
  keyPoints: string[];
  wordCount: number;
  linkCount: number;
  imageCount: number;
  headingCount: number;
  createdAt: Date;
  userId: string;
}

export const summariesRouter = Router();

// Apply authentication to all routes
summariesRouter.use(authenticate);

// Validation schema
const createSummarySchema = z.object({
  title: z.string().min(1).max(500),
  url: z.string().url(),
  summary: z.string().max(5000),
  keyPoints: z.array(z.string()).optional().default([]),
  stats: z.object({
    words: z.number().optional().default(0),
    links: z.number().optional().default(0),
    images: z.number().optional().default(0),
    headings: z.number().optional().default(0)
  }).optional()
});

// GET /api/summaries - Get all summaries for user
summariesRouter.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const summaries = await prisma.summary.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    res.json(summaries.map((s: SummaryRecord) => ({
      id: s.id,
      title: s.title,
      url: s.url,
      summary: s.summary,
      keyPoints: s.keyPoints,
      stats: {
        words: s.wordCount,
        links: s.linkCount,
        images: s.imageCount,
        headings: s.headingCount
      },
      createdAt: s.createdAt
    })));
  } catch (error) {
    next(error);
  }
});

// POST /api/summaries - Create new summary
summariesRouter.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = createSummarySchema.parse(req.body);

    const summary = await prisma.summary.create({
      data: {
        title: data.title,
        url: data.url,
        summary: data.summary,
        keyPoints: data.keyPoints,
        wordCount: data.stats?.words || 0,
        linkCount: data.stats?.links || 0,
        imageCount: data.stats?.images || 0,
        headingCount: data.stats?.headings || 0,
        userId: req.userId!
      }
    });

    res.status(201).json({
      id: summary.id,
      title: summary.title,
      url: summary.url,
      summary: summary.summary,
      keyPoints: summary.keyPoints,
      stats: {
        words: summary.wordCount,
        links: summary.linkCount,
        images: summary.imageCount,
        headings: summary.headingCount
      },
      createdAt: summary.createdAt
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Invalid summary data', 400, 'VALIDATION_ERROR'));
    }
    next(error);
  }
});

// DELETE /api/summaries/:id - Delete summary
summariesRouter.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.summary.findFirst({
      where: { id: req.params.id, userId: req.userId }
    });

    if (!existing) {
      return next(createError('Summary not found', 404, 'NOT_FOUND'));
    }

    await prisma.summary.delete({
      where: { id: req.params.id }
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});
