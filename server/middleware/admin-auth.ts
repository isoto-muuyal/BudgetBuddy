import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";

export interface AuthenticatedAdminRequest extends Request {
  admin?: {
    adminId: number;
    username: string;
    role: string;
  };
}

export function authenticateAdminToken(req: AuthenticatedAdminRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    return res.status(401).json({ message: "Admin access token required" });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as AuthenticatedAdminRequest["admin"];
    if (!decoded || decoded.role !== "admin") {
      return res.status(403).json({ message: "Invalid admin token" });
    }

    req.admin = decoded;
    next();
  } catch {
    return res.status(403).json({ message: "Invalid or expired admin token" });
  }
}
