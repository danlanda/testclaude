import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../config/database.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { createError } from '../middleware/errorHandler.js';

export const tripsRouter = Router();

// Apply authentication to all routes
tripsRouter.use(authenticate);

// Validation schemas
const createTripSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  startDate: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  endDate: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined)
});

const updateTripSchema = createTripSchema.partial();

// GET /api/trips - Get all trips for user
tripsRouter.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const trips = await prisma.trip.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { places: true }
        }
      }
    });

    res.json(trips);
  } catch (error) {
    next(error);
  }
});

// GET /api/trips/:id - Get single trip with places
tripsRouter.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const trip = await prisma.trip.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId
      },
      include: {
        places: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!trip) {
      return next(createError('Trip not found', 404, 'NOT_FOUND'));
    }

    res.json(trip);
  } catch (error) {
    next(error);
  }
});

// POST /api/trips - Create new trip
tripsRouter.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = createTripSchema.parse(req.body);

    const trip = await prisma.trip.create({
      data: {
        ...data,
        userId: req.userId!
      }
    });

    res.status(201).json(trip);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Invalid trip data', 400, 'VALIDATION_ERROR'));
    }
    next(error);
  }
});

// PATCH /api/trips/:id - Update trip
tripsRouter.patch('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = updateTripSchema.parse(req.body);

    // Verify trip belongs to user
    const existing = await prisma.trip.findFirst({
      where: { id: req.params.id, userId: req.userId }
    });

    if (!existing) {
      return next(createError('Trip not found', 404, 'NOT_FOUND'));
    }

    const trip = await prisma.trip.update({
      where: { id: req.params.id },
      data
    });

    res.json(trip);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Invalid trip data', 400, 'VALIDATION_ERROR'));
    }
    next(error);
  }
});

// DELETE /api/trips/:id - Delete trip
tripsRouter.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Verify trip belongs to user
    const existing = await prisma.trip.findFirst({
      where: { id: req.params.id, userId: req.userId }
    });

    if (!existing) {
      return next(createError('Trip not found', 404, 'NOT_FOUND'));
    }

    // This will set tripId to null on associated places (due to onDelete: SetNull)
    await prisma.trip.delete({
      where: { id: req.params.id }
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// POST /api/trips/:id/places - Add place to trip
tripsRouter.post('/:id/places', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { placeId } = z.object({ placeId: z.string().uuid() }).parse(req.body);

    // Verify trip belongs to user
    const trip = await prisma.trip.findFirst({
      where: { id: req.params.id, userId: req.userId }
    });

    if (!trip) {
      return next(createError('Trip not found', 404, 'TRIP_NOT_FOUND'));
    }

    // Verify place belongs to user
    const place = await prisma.place.findFirst({
      where: { id: placeId, userId: req.userId }
    });

    if (!place) {
      return next(createError('Place not found', 404, 'PLACE_NOT_FOUND'));
    }

    // Add place to trip
    const updatedPlace = await prisma.place.update({
      where: { id: placeId },
      data: { tripId: req.params.id }
    });

    res.json(updatedPlace);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Invalid request', 400, 'VALIDATION_ERROR'));
    }
    next(error);
  }
});

// DELETE /api/trips/:id/places/:placeId - Remove place from trip
tripsRouter.delete('/:id/places/:placeId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Verify place belongs to user and is in this trip
    const place = await prisma.place.findFirst({
      where: {
        id: req.params.placeId,
        userId: req.userId,
        tripId: req.params.id
      }
    });

    if (!place) {
      return next(createError('Place not found in trip', 404, 'NOT_FOUND'));
    }

    // Remove place from trip (but don't delete the place)
    const updatedPlace = await prisma.place.update({
      where: { id: req.params.placeId },
      data: { tripId: null }
    });

    res.json(updatedPlace);
  } catch (error) {
    next(error);
  }
});
