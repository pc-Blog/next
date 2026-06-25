/**
 * 缓存清除 — 调用 Cloudflare API 清空 CDN 缓存
 *
 * POST /purge
 *   body: { "prefixes": ["analytics.lxpavilion.top"] }  按前缀清除
 *   body: { "files": ["https://..."] }                   按 URL 清除
 *
 * 需要 CF_API_TOKEN 拥有 Cache Purge 权限。
 */

import type { Env } from "../types";
import { corsHeaders, respond } from "../utils/response";

const CF_API_BASE = "https://api.cloudflare.com/client/v4";

export async function handlePurge(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  origin: string | null
): Promise<Response> {
  if (request.method !== "POST") {
    return respond(null, "Method not allowed", 0, origin);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return respond(null, "Invalid JSON body", 0, origin);
  }

  // 验证 body 必须有 files 或 prefixes
  if (!body.files && !body.prefixes) {
    return respond(null, 'Body must have "files" or "prefixes"', 0, origin);
  }

  try {
    const resp = await fetch(`${CF_API_BASE}/zones/${env.CF_ZONE_ID}/purge_cache`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.CF_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const result = await resp.json();

    if (!resp.ok) {
      return respond(result, "Purge failed", 0, origin);
    }

    return respond(result, "Cache purged", 1, origin);
  } catch (e) {
    return respond(null, `Purge error: ${(e as Error).message}`, 0, origin);
  }
}
