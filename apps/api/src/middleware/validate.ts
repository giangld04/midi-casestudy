// Generic request-body validation middleware. Parses req.body with a Zod
// schema, replaces it with the typed/coerced result, and forwards ZodErrors
// to the global error handler (which renders a 400).
import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";

/** Validate req.body against `schema`; on failure defer to the error handler */
export const validateBody =
  (schema: ZodTypeAny) => (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(result.error);
      return;
    }
    req.body = result.data;
    next();
  };
