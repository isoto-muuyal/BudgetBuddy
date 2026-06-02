import { config } from "../config";

type JsonObject = Record<string, unknown>;

interface McpToolRequest {
  tool: string;
  arguments: JsonObject;
}

export class McpClientService {
  private cachedJwt = "";

  isEnabled(): boolean {
    return config.ai.service === "mcp" && Boolean(config.mcp.baseUrl);
  }

  async callTool<T>(tool: string, args: JsonObject): Promise<T> {
    if (!config.mcp.baseUrl) {
      throw new Error("MCP_BASE_URL is required when AI_SERVICE=mcp");
    }

    const jwt = await this.getJwt();
    const response = await fetch(this.buildUrl(config.mcp.toolsPath), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        tool,
        arguments: args,
      } satisfies McpToolRequest),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`MCP tool "${tool}" failed with ${response.status}: ${body}`);
    }

    return this.normalizeToolResponse<T>(await response.json());
  }

  private async getJwt(): Promise<string> {
    if (config.mcp.jwt) {
      return config.mcp.jwt;
    }

    if (this.cachedJwt) {
      return this.cachedJwt;
    }

    const loginBody = this.getLoginBody();
    const response = await fetch(this.buildUrl(config.mcp.loginPath), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(loginBody),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`MCP login failed with ${response.status}: ${body}`);
    }

    const payload = await response.json();
    const jwt = this.extractJwt(payload);
    if (!jwt) {
      throw new Error("MCP login response did not include a jwt, token, or accessToken value");
    }

    this.cachedJwt = jwt;
    return jwt;
  }

  private getLoginBody(): JsonObject {
    if (config.mcp.loginBodyJson) {
      const parsed = JSON.parse(config.mcp.loginBodyJson);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("MCP_LOGIN_BODY_JSON must be a JSON object");
      }
      return parsed as JsonObject;
    }

    return {
      username: config.mcp.username,
      password: config.mcp.password,
    };
  }

  private extractJwt(value: unknown): string {
    if (!value || typeof value !== "object") return "";
    const payload = value as Record<string, unknown>;
    const direct = payload.jwt || payload.token || payload.accessToken || payload.access_token;
    if (typeof direct === "string") return direct;

    const data = payload.data;
    if (data && typeof data === "object") {
      return this.extractJwt(data);
    }

    return "";
  }

  private normalizeToolResponse<T>(value: unknown): T {
    if (!value || typeof value !== "object") {
      return value as T;
    }

    const payload = value as Record<string, unknown>;
    if ("result" in payload) return payload.result as T;
    if ("data" in payload) return payload.data as T;
    if ("content" in payload) return this.normalizeContent<T>(payload.content);
    return payload as T;
  }

  private normalizeContent<T>(content: unknown): T {
    if (Array.isArray(content) && content.length === 1) {
      const first = content[0];
      if (first && typeof first === "object" && "text" in first) {
        return this.parseMaybeJson((first as { text: unknown }).text) as T;
      }
    }

    return this.parseMaybeJson(content) as T;
  }

  private parseMaybeJson(value: unknown): unknown {
    if (typeof value !== "string") return value;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  private buildUrl(path: string): string {
    return new URL(path, config.mcp.baseUrl).toString();
  }
}

export const mcpClientService = new McpClientService();
