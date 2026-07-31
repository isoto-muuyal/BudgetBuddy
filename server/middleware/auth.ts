import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { storage } from "../storage";

export interface AuthenticatedRequest extends Request {
  user?: any;
}

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: "Access token required" });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as any;
    const user = await storage.getUser(decoded.userId);

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    if (user.frozen) {
      return res.status(403).json({ message: "This account has been frozen. Please contact support." });
    }

    const allowedDuringForcedPasswordChange = new Set([
      "/api/user/profile",
      "/api/auth/complete-password-change",
    ]);
    if (user.forcePasswordChange && !allowedDuringForcedPasswordChange.has(req.path)) {
      return res.status(403).json({ message: "Password change required before continuing." });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};
