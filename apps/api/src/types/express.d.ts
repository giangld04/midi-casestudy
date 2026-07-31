// Express Request augmentation — adds user and session after requireAuth middleware.
import type { Session, User } from "better-auth";

declare global {
  namespace Express {
    interface Request {
      /** Authenticated user (set by requireAuth middleware) */
      user?: User;
      /** Active session (set by requireAuth middleware) */
      session?: Session;
    }
  }
}
