import type { IncomingMessage, ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";
import { join } from "node:path";

type ServerHandler = {
  fetch: (req: Request, env: unknown, ctx: unknown) => Promise<Response>;
};

let server: ServerHandler | null = null;

async function getServer(): Promise<ServerHandler> {
  if (!server) {
    // Vercel places includeFiles at the project root (/var/task/).
    // process.cwd() reliably points there at runtime.
    const serverPath = join(process.cwd(), "dist", "server", "server.js");
    console.log("[ssr] loading server from:", serverPath);
    const mod = await import(pathToFileURL(serverPath).href);
    server = mod.default as ServerHandler;
  }
  return server;
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  let srv: ServerHandler;
  try {
    srv = await getServer();
  } catch (err) {
    console.error("[ssr] failed to load server:", err);
    res.statusCode = 500;
    res.setHeader("content-type", "text/plain");
    res.end("Server failed to load: " + String(err));
    return;
  }

  const protocol = String(req.headers["x-forwarded-proto"] ?? "https");
  const host = String(
    req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost",
  );
  const url = new URL(req.url ?? "/", `${protocol}://${host}`);

  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v !== undefined) {
      (Array.isArray(v) ? v : [v]).forEach((val) => headers.append(k, val));
    }
  }

  let body: BodyInit | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    const chunks: Buffer[] = [];
    for await (const chunk of req as AsyncIterable<Buffer>) {
      chunks.push(chunk as Buffer);
    }
    if (chunks.length > 0) body = Buffer.concat(chunks);
  }

  const request = new Request(url.href, { method: req.method, headers, body });

  let response: Response;
  try {
    response = await srv.fetch(request, process.env, {});
  } catch (err) {
    console.error("[ssr] fetch error:", err);
    res.statusCode = 500;
    res.setHeader("content-type", "text/plain");
    res.end("SSR fetch error: " + String(err));
    return;
  }

  res.statusCode = response.status;
  for (const [k, v] of response.headers.entries()) {
    res.setHeader(k, v);
  }

  const buffer = await response.arrayBuffer();
  res.end(Buffer.from(buffer));
}
