import { Request, Response, NextFunction } from 'express';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('API Error:', err);

  const statusCode = err.statusCode || (err.name === 'ValidationError' || err.name === 'ZodError' ? 400 : 500);
  const message = err.message || 'Internal server error occurred. Please try again.';

  res.status(statusCode).json({
    success: false,
    error: message,
    details: err.errors || undefined,
  });
};
