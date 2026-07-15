import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { storage } from "../storage";
import { config } from "../config";
import type { SiteVisit } from "@shared/schema";

export type VisitLogEntry = {
  timestamp: string;
  page: string;
  button: string;
  section: string;
  location: string;
  ipAddress: string;
  userIdentifier: string;
};

export class AdminService {
  getClientIp(headers: Record<string, unknown>, fallbackIp?: string): string {
    const forwarded = typeof headers["x-forwarded-for"] === "string" ? headers["x-forwarded-for"] : "";
    const realIp = typeof headers["x-real-ip"] === "string" ? headers["x-real-ip"] : "";
    const candidate = forwarded.split(",")[0]?.trim() || realIp || fallbackIp || "unknown";
    return candidate;
  }

  getVisitorLocation(headers: Record<string, unknown>): string {
    const country = typeof headers["cf-ipcountry"] === "string"
      ? headers["cf-ipcountry"]
      : typeof headers["x-vercel-ip-country"] === "string"
        ? headers["x-vercel-ip-country"]
        : typeof headers["x-country-code"] === "string"
          ? headers["x-country-code"]
          : "";
    const region = typeof headers["x-vercel-ip-country-region"] === "string" ? headers["x-vercel-ip-country-region"] : "";
    const city = typeof headers["x-vercel-ip-city"] === "string" ? headers["x-vercel-ip-city"] : "";

    return [city, region, country].filter(Boolean).join(", ") || "unknown";
  }

  async login(username: string, password: string) {
    const admin = await storage.getAdminByUsername(username);
    if (!admin) {
      throw new Error("Invalid admin username or password");
    }

    const isValid = await bcrypt.compare(password, admin.password);
    if (!isValid) {
      throw new Error("Invalid admin username or password");
    }

    const token = jwt.sign(
      { adminId: admin.id, username: admin.username, role: "admin" },
      config.jwt.secret,
      { expiresIn: "12h" }
    );

    return {
      token,
      admin: {
        id: admin.id,
        username: admin.username,
      },
    };
  }

  async trackVisit(entry: VisitLogEntry): Promise<void> {
    await storage.trackVisit({
      ...entry,
      timestamp: new Date(entry.timestamp),
    });
  }

  async getVisits(): Promise<VisitLogEntry[]> {
    const visits = await storage.getVisits();
    return visits.map((visit: SiteVisit) => ({
      timestamp: visit.timestamp.toISOString(),
      page: visit.page,
      button: visit.button ?? "",
      section: visit.section ?? "",
      location: visit.location ?? "",
      ipAddress: visit.ipAddress ?? "",
      userIdentifier: visit.userIdentifier ?? "",
    }));
  }
}

export const adminService = new AdminService();
