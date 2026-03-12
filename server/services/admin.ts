import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { promises as fs } from "fs";
import path from "path";
import { storage } from "../storage";
import { config } from "../config";

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
  private csvPath = config.admin.visitsCsvPath;

  private async ensureCsvFile(): Promise<void> {
    const dir = path.dirname(this.csvPath);
    await fs.mkdir(dir, { recursive: true });
    try {
      await fs.access(this.csvPath);
    } catch {
      await fs.writeFile(this.csvPath, "timestamp,page,button,section,location,ip_address,user_identifier\n", "utf8");
    }
  }

  private escapeCsv(value: string): string {
    const normalized = value.replace(/\r?\n/g, " ").trim();
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  private parseCsvLine(line: string): string[] {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"' && inQuotes && nextChar === '"') {
        current += '"';
        i += 1;
        continue;
      }

      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }

      if (char === "," && !inQuotes) {
        values.push(current);
        current = "";
        continue;
      }

      current += char;
    }

    values.push(current);
    return values;
  }

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
    await this.ensureCsvFile();
    const row = [
      this.escapeCsv(entry.timestamp),
      this.escapeCsv(entry.page),
      this.escapeCsv(entry.button),
      this.escapeCsv(entry.section),
      this.escapeCsv(entry.location),
      this.escapeCsv(entry.ipAddress),
      this.escapeCsv(entry.userIdentifier),
    ].join(",") + "\n";

    await fs.appendFile(this.csvPath, row, "utf8");
  }

  async getVisits(): Promise<VisitLogEntry[]> {
    await this.ensureCsvFile();
    const content = await fs.readFile(this.csvPath, "utf8");
    const lines = content.split(/\r?\n/).filter(Boolean);

    return lines.slice(1).map((line) => {
      const [timestamp = "", page = "", button = "", section = "", location = "", ipAddress = "", userIdentifier = ""] = this.parseCsvLine(line);
      return { timestamp, page, button, section, location, ipAddress, userIdentifier };
    }).reverse();
  }
}

export const adminService = new AdminService();
