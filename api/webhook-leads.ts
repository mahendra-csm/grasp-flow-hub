import type { IncomingMessage, ServerResponse } from "node:http";
import { handleWebhookLeads } from "../src/lib/webhook-leads";

async function toWebRequest(req: IncomingMessage): Promise<Request> {
  const protocol = String(req.headers["x-forwarded-proto"] ?? "https");
  const host = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost");
  const url = new URL(req.url ?? "/", `${protocol}://${host}`);

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (!value) continue;
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) headers.append(key, item);
  }

  let body: BodyInit | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    const chunks: Buffer[] = [];
    for await (const chunk of req as AsyncIterable<Buffer>) {
      chunks.push(chunk);
    }
    if (chunks.length) body = Buffer.concat(chunks);
  }

  return new Request(url.href, { method: req.method, headers, body });
}

async function sendWebResponse(res: ServerResponse, response: Response) {
  res.statusCode = response.status;
  for (const [key, value] of response.headers.entries()) {
    res.setHeader(key, value);
  }
  const data = await response.arrayBuffer();
  res.end(Buffer.from(data));
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const request = await toWebRequest(req);
  const response = await handleWebhookLeads(request);
  await sendWebResponse(res, response);
}
