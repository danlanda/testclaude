import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../config/database.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { createError } from '../middleware/errorHandler.js';

export const placesRouter = Router();

// Apply authentication to all routes
placesRouter.use(authenticate);

// Validation schemas
const createPlaceSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  category: z.enum(['accommodation', 'activities', 'food', 'transportation']),
  location: z.string().max(200).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  bookingLink: z.string().url().optional().or(z.literal('')),
  mapsLink: z.string().url().optional().or(z.literal('')),
  sourceUrl: z.string().url().optional().or(z.literal('')),
  sourceTitle: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
  tripId: z.string().uuid().optional()
});

const updatePlaceSchema = createPlaceSchema.partial().extend({
  rating: z.number().min(1).max(5).optional(),
  visited: z.boolean().optional()
});

const querySchema = z.object({
  category: z.enum(['accommodation', 'activities', 'food', 'transportation']).optional(),
  location: z.string().optional(),
  tripId: z.string().uuid().optional(),
  visited: z.string().transform(val => val === 'true').optional(),
  limit: z.string().transform(Number).optional(),
  offset: z.string().transform(Number).optional()
});

// GET /api/places - Get all places for user
placesRouter.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const query = querySchema.parse(req.query);

    const where: any = { userId: req.userId };

    if (query.category) {
      where.category = query.category;
    }

    if (query.location) {
      where.location = { contains: query.location };
    }

    if (query.tripId) {
      where.tripId = query.tripId;
    }

    if (query.visited !== undefined) {
      where.visited = query.visited;
    }

    const places = await prisma.place.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: query.limit || 100,
      skip: query.offset || 0,
      include: {
        trip: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    const total = await prisma.place.count({ where });

    res.json({
      places,
      total,
      limit: query.limit || 100,
      offset: query.offset || 0
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Invalid query parameters', 400, 'VALIDATION_ERROR'));
    }
    next(error);
  }
});

// GET /api/places/stats - Get place statistics
placesRouter.get('/stats', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [total, byCategory, visited] = await Promise.all([
      prisma.place.count({ where: { userId: req.userId } }),
      prisma.place.groupBy({
        by: ['category'],
        where: { userId: req.userId },
        _count: true
      }),
      prisma.place.count({ where: { userId: req.userId, visited: true } })
    ]);

    const categories = {
      accommodation: 0,
      activities: 0,
      food: 0,
      transportation: 0
    };

    byCategory.forEach(item => {
      categories[item.category as keyof typeof categories] = item._count;
    });

    res.json({
      total,
      visited,
      categories
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/places/:id - Get single place
placesRouter.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const place = await prisma.place.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId
      },
      include: {
        trip: true
      }
    });

    if (!place) {
      return next(createError('Place not found', 404, 'NOT_FOUND'));
    }

    res.json(place);
  } catch (error) {
    next(error);
  }
});

// POST /api/places - Create new place
placesRouter.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = createPlaceSchema.parse(req.body);

    // Clean empty strings to null
    const cleanedData = {
      ...data,
      bookingLink: data.bookingLink || null,
      mapsLink: data.mapsLink || generateMapsLink(data.name, data.location),
      sourceUrl: data.sourceUrl || null
    };

    // Verify trip belongs to user if provided
    if (cleanedData.tripId) {
      const trip = await prisma.trip.findFirst({
        where: { id: cleanedData.tripId, userId: req.userId }
      });
      if (!trip) {
        return next(createError('Trip not found', 404, 'TRIP_NOT_FOUND'));
      }
    }

    const place = await prisma.place.create({
      data: {
        ...cleanedData,
        userId: req.userId!
      }
    });

    res.status(201).json(place);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Invalid place data: ' + error.errors[0].message, 400, 'VALIDATION_ERROR'));
    }
    next(error);
  }
});

// POST /api/places/bulk - Create multiple places
placesRouter.post('/bulk', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const placesData = z.array(createPlaceSchema).parse(req.body);

    const places = await prisma.place.createMany({
      data: placesData.map(data => ({
        ...data,
        bookingLink: data.bookingLink || null,
        mapsLink: data.mapsLink || generateMapsLink(data.name, data.location),
        sourceUrl: data.sourceUrl || null,
        userId: req.userId!
      }))
    });

    res.status(201).json({ created: places.count });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Invalid places data', 400, 'VALIDATION_ERROR'));
    }
    next(error);
  }
});

// PATCH /api/places/:id - Update place
placesRouter.patch('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = updatePlaceSchema.parse(req.body);

    // Verify place belongs to user
    const existing = await prisma.place.findFirst({
      where: { id: req.params.id, userId: req.userId }
    });

    if (!existing) {
      return next(createError('Place not found', 404, 'NOT_FOUND'));
    }

    // Verify trip belongs to user if provided
    if (data.tripId) {
      const trip = await prisma.trip.findFirst({
        where: { id: data.tripId, userId: req.userId }
      });
      if (!trip) {
        return next(createError('Trip not found', 404, 'TRIP_NOT_FOUND'));
      }
    }

    const place = await prisma.place.update({
      where: { id: req.params.id },
      data
    });

    res.json(place);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Invalid place data', 400, 'VALIDATION_ERROR'));
    }
    next(error);
  }
});

// DELETE /api/places/:id - Delete place
placesRouter.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Verify place belongs to user
    const existing = await prisma.place.findFirst({
      where: { id: req.params.id, userId: req.userId }
    });

    if (!existing) {
      return next(createError('Place not found', 404, 'NOT_FOUND'));
    }

    await prisma.place.delete({
      where: { id: req.params.id }
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Helper: Generate Google Maps link
function generateMapsLink(name: string, location?: string): string {
  const query = location ? `${name}, ${location}` : name;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
