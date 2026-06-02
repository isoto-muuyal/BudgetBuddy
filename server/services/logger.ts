import { config } from "../config";

type LogLevel = "debug" | "info" | "warn" | "error";
type LogFields = Record<string, unknown>;

interface LogEvent {
  timestamp: string;
  level: LogLevel;
  service: string;
  environment: string;
  message: string;
  traceId?: string;
  fields?: LogFields;
}

class Logger {
  info(message: string, fields: LogFields = {}): void {
    this.write("info", message, fields);
  }

  warn(message: string, fields: LogFields = {}): void {
    this.write("warn", message, fields);
  }

  error(message: string, fields: LogFields = {}): void {
    this.write("error", message, fields);
  }

  debug(message: string, fields: LogFields = {}): void {
    if (process.env.LOG_LEVEL !== "debug") return;
    this.write("debug", message, fields);
  }

  private write(level: LogLevel, message: string, fields: LogFields): void {
    const sanitizedFields = this.sanitize(fields);
    const traceId = typeof sanitizedFields.traceId === "string" ? sanitizedFields.traceId : undefined;
    if (traceId) {
      delete sanitizedFields.traceId;
    }

    const event: LogEvent = {
      timestamp: new Date().toISOString(),
      level,
      service: config.observability.serviceName,
      environment: config.observability.environment,
      message,
      traceId,
      fields: sanitizedFields,
    };

    const serialized = JSON.stringify(event);
    if (level === "error") {
      console.error(serialized);
    } else if (level === "warn") {
      console.warn(serialized);
    } else {
      console.log(serialized);
    }

    this.sendToLoki(event).catch((error) => {
      console.warn(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "warn",
          service: config.observability.serviceName,
          environment: config.observability.environment,
          message: "Failed to export log to Loki",
          fields: { error: error instanceof Error ? error.message : String(error) },
        })
      );
    });
  }

  private async sendToLoki(event: LogEvent): Promise<void> {
    if (!config.observability.lokiUrl) return;

    const labels = {
      service: config.observability.serviceName,
      environment: config.observability.environment,
      level: event.level,
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (config.observability.lokiUsername && config.observability.lokiPassword) {
      headers.Authorization = `Basic ${Buffer.from(
        `${config.observability.lokiUsername}:${config.observability.lokiPassword}`
      ).toString("base64")}`;
    }

    const response = await fetch(config.observability.lokiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        streams: [
          {
            stream: labels,
            values: [[`${Date.now()}000000`, JSON.stringify(event)]],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Loki returned ${response.status}`);
    }
  }

  private sanitize(value: unknown): LogFields {
    return this.redact(value) as LogFields;
  }

  private redact(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.redact(item));
    }

    if (!value || typeof value !== "object") {
      return value;
    }

    return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>((accumulator, [key, item]) => {
      if (/password|token|secret|authorization|cookie|jwt|api[_-]?key/i.test(key)) {
        accumulator[key] = "[REDACTED]";
      } else {
        accumulator[key] = this.redact(item);
      }
      return accumulator;
    }, {});
  }
}

export const logger = new Logger();
