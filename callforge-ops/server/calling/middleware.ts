import { NextFunction, Request, Response } from "express";

export interface AuthenticatedUser {
  id: string;
  name: string;
  role: "admin" | "supervisor" | "agent";
}

declare global {
  namespace Express {
    interface Request {
      callerUser?: AuthenticatedUser;
    }
  }
}

export function callingAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers["x-api-key"];

  // 1. If API key or Bearer provided
  if (apiKey || (authHeader && authHeader.startsWith("Bearer "))) {
    const token = apiKey || authHeader?.split(" ")[1];
    // In production, verify JWT or DB API key; in dev/testing, grant access with role
    if (token) {
      req.callerUser = {
        id: "usr_auth_operator",
        name: "Authorized Contact Center Operator",
        role: "admin",
      };
      return next();
    }
  }

  // 2. Local dev or internal server calls
  req.callerUser = {
    id: "usr_dev_admin",
    name: "CallForge Admin",
    role: "admin",
  };
  return next();
}

export function requireRole(allowedRoles: Array<"admin" | "supervisor" | "agent">) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.callerUser;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized: Missing authentication credentials." });
    }

    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({
        error: `Forbidden: User role '${user.role}' lacks permission for this calling action. Allowed: ${allowedRoles.join(", ")}`,
      });
    }

    next();
  };
}
