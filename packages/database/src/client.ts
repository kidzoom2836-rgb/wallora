import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function curlFetch(url: any, init?: any): Promise<any> {
  const { execFileSync } = require("child_process");
  return new Promise((resolve, reject) => {
    try {
      const u = typeof url === "string" ? url : (url && url.url) || String(url);
      const method = (init && init.method) || "GET";
      const args = ["-s", "-S", "-i", "-X", method];
      if (init && init.headers) {
        const h = init.headers;
        const entries = h instanceof Headers ? Array.from(h.entries()) : Object.entries(h);
        for (const [k, v] of entries) args.push("-H", `${k}: ${v}`);
      }
      if (init && init.body) {
        const body = typeof init.body === "string" ? init.body : JSON.stringify(init.body);
        args.push("-d", body);
      }
      args.push(u);
      const out = execFileSync("curl", args, { encoding: "utf8", timeout: 30000, maxBuffer: 10 * 1024 * 1024 });
      const idx = out.indexOf("\r\n\r\n");
      const head = idx >= 0 ? out.slice(0, idx) : out;
      const responseBody = idx >= 0 ? out.slice(idx + 4) : "";
      const statusLine = head.split("\r\n")[0];
      const status = parseInt(statusLine.split(" ")[1], 10) || 0;
      const headers = new Map<string, string>();
      head.split("\r\n").slice(1).forEach((l: string) => {
        const i = l.indexOf(":");
        if (i > 0) headers.set(l.slice(0, i).trim().toLowerCase(), l.slice(i + 1).trim());
      });
      resolve({
        ok: status >= 200 && status < 300,
        status,
        statusText: statusLine.split(" ").slice(2).join(" "),
        headers: { get: (k: string) => headers.get(k.toLowerCase()) ?? null },
        text: async () => responseBody,
        json: async () => JSON.parse(responseBody),
        arrayBuffer: async () => Buffer.from(responseBody),
      });
    } catch (e) {
      reject(e);
    }
  });
}

// Use curl-based fetch because Node's native fetch can't reach Neon in this env.
neonConfig.fetchFunction = curlFetch as any;

export function createDb(databaseUrl: string) {
  const sql = neon(databaseUrl);
  return drizzle(sql, { schema });
}

export type Database = ReturnType<typeof createDb>;
