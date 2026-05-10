import type { IncomingMessage, ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

type ServerHandler = {
  fetch: (req: Request, env: unknown, ctx: unknown) => Promise<Response>;
};

let server: ServerHandler | null = null;

async function getServer(): Promise<ServerHandler> {
  if (!server) {
    const serverPath = join(__dirname, "dist", "server", "server.js");
    const mod = await import(pathToFileURL(serverPath).href);
    server = mod.default as ServerHandler;
  }
  return server;
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const srv = await getServer();

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
  const response = await srv.fetch(request, process.env, {});

  res.statusCode = response.status;
  for (const [k, v] of response.headers.entries()) {
    res.setHeader(k, v);
  }

  const buffer = await response.arrayBuffer();
  res.end(Buffer.from(buffer));
}
