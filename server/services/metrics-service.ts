import { performance } from "node:perf_hooks";
import type { Request, Response, NextFunction } from "express";

type Labels = Record<string, string | number>;

interface HistogramEntry {
  count: number;
  sum: number;
  buckets: Map<number, number>;
}

const HTTP_BUCKETS_SECONDS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

class MetricsService {
  private readonly startedAt = Date.now();
  private readonly counters = new Map<string, number>();
  private readonly histograms = new Map<string, HistogramEntry>();

  httpMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const started = performance.now();

      res.on("finish", () => {
        const durationSeconds = (performance.now() - started) / 1000;
        const labels = {
          method: req.method,
          route: this.normalizePath(req),
          status_code: res.statusCode,
        };

        this.increment("http_requests_total", labels);
        this.observe("http_request_duration_seconds", labels, durationSeconds, HTTP_BUCKETS_SECONDS);
      });

      next();
    };
  }

  increment(name: string, labels: Labels = {}, value = 1): void {
    const key = this.metricKey(name, labels);
    this.counters.set(key, (this.counters.get(key) || 0) + value);
  }

  observe(name: string, labels: Labels, value: number, buckets: number[]): void {
    const key = this.metricKey(name, labels);
    const entry =
      this.histograms.get(key) ||
      {
        count: 0,
        sum: 0,
        buckets: new Map(buckets.map((bucket) => [bucket, 0])),
      };

    entry.count += 1;
    entry.sum += value;
    for (const bucket of buckets) {
      if (value <= bucket) {
        entry.buckets.set(bucket, (entry.buckets.get(bucket) || 0) + 1);
      }
    }

    this.histograms.set(key, entry);
  }

  render(): string {
    const lines: string[] = [];
    const memory = process.memoryUsage();

    lines.push("# HELP app_info Application metadata.");
    lines.push("# TYPE app_info gauge");
    lines.push(`app_info{node_version="${this.escapeLabel(process.version)}"} 1`);
    lines.push("# HELP process_uptime_seconds Process uptime in seconds.");
    lines.push("# TYPE process_uptime_seconds gauge");
    lines.push(`process_uptime_seconds ${Math.round((Date.now() - this.startedAt) / 1000)}`);
    lines.push("# HELP process_memory_rss_bytes Resident memory size in bytes.");
    lines.push("# TYPE process_memory_rss_bytes gauge");
    lines.push(`process_memory_rss_bytes ${memory.rss}`);
    lines.push("# HELP process_memory_heap_used_bytes Node.js heap used in bytes.");
    lines.push("# TYPE process_memory_heap_used_bytes gauge");
    lines.push(`process_memory_heap_used_bytes ${memory.heapUsed}`);
    lines.push("# HELP http_requests_total Total HTTP requests.");
    lines.push("# TYPE http_requests_total counter");
    this.renderCounters(lines);
    lines.push("# HELP http_request_duration_seconds HTTP request duration in seconds.");
    lines.push("# TYPE http_request_duration_seconds histogram");
    this.renderHistograms(lines);

    return `${lines.join("\n")}\n`;
  }

  private renderCounters(lines: string[]): void {
    for (const [key, value] of Array.from(this.counters.entries())) {
      const { name, labels } = this.parseMetricKey(key);
      lines.push(`${name}${this.renderLabels(labels)} ${value}`);
    }
  }

  private renderHistograms(lines: string[]): void {
    for (const [key, entry] of Array.from(this.histograms.entries())) {
      const { name, labels } = this.parseMetricKey(key);
      let cumulative = 0;
      for (const [bucket, count] of Array.from(entry.buckets.entries()).sort((left, right) => left[0] - right[0])) {
        cumulative = count;
        lines.push(`${name}_bucket${this.renderLabels({ ...labels, le: bucket })} ${cumulative}`);
      }
      lines.push(`${name}_bucket${this.renderLabels({ ...labels, le: "+Inf" })} ${entry.count}`);
      lines.push(`${name}_sum${this.renderLabels(labels)} ${entry.sum}`);
      lines.push(`${name}_count${this.renderLabels(labels)} ${entry.count}`);
    }
  }

  private normalizePath(req: Request): string {
    const routePath = req.route?.path;
    if (typeof routePath === "string") {
      return req.baseUrl ? `${req.baseUrl}${routePath}` : routePath;
    }

    return req.path
      .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ":id")
      .replace(/\/\d+/g, "/:id")
      .slice(0, 120);
  }

  private metricKey(name: string, labels: Labels): string {
    return JSON.stringify({ name, labels: this.sortLabels(labels) });
  }

  private parseMetricKey(key: string): { name: string; labels: Labels } {
    return JSON.parse(key) as { name: string; labels: Labels };
  }

  private sortLabels(labels: Labels): Labels {
    return Object.keys(labels)
      .sort()
      .reduce<Labels>((accumulator, key) => {
        accumulator[key] = labels[key];
        return accumulator;
      }, {});
  }

  private renderLabels(labels: Labels): string {
    const entries = Object.entries(labels);
    if (!entries.length) return "";
    return `{${entries.map(([key, value]) => `${key}="${this.escapeLabel(String(value))}"`).join(",")}}`;
  }

  private escapeLabel(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"');
  }
}

export const metricsService = new MetricsService();
