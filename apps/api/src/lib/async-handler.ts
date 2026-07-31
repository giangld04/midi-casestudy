// Express 4 does not forward rejected promises to error middleware.
// This wrapper catches async errors and passes them to next() so the
// global error-handler can format them consistently.
import type { NextFunction, Request, RequestHandler, Response } from "express";

/** Wrap an async route handler so thrown/rejected errors reach the error handler */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
