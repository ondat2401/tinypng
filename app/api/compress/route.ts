import { NextRequest } from "next/server";
import tinify from "tinify";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const CONVERT_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const RESIZE_METHODS = new Set(["scale", "fit", "cover", "thumb"]);
const MAX_SIZE = 30 * 1024 * 1024; // 30MB
const FREE_LIMIT = 500;

// Resolve key: prefer the header entered by the user on the web, fall back to .env
function resolveKey(req: NextRequest): string | null {
  const headerKey = req.headers.get("x-api-key");
  if (headerKey && headerKey.trim()) return headerKey.trim();
  const envKey = process.env.TINIFY_API_KEY;
  if (!envKey || envKey === "your_api_key_here") return null;
  return envKey;
}

// GET: return the used quota for the current key (for the quota meter)
export async function GET(req: NextRequest) {
  const apiKey = resolveKey(req);
  if (!apiKey) {
    return json({ error: "missing_key" }, 500);
  }
  tinify.key = apiKey;
  try {
    await tinify.validate();
    return json({ count: tinify.compressionCount ?? 0, limit: FREE_LIMIT }, 200);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  const apiKey = resolveKey(req);
  if (!apiKey) {
    return json(
      {
        error:
          "No API key set. Enter a key on the web or configure TINIFY_API_KEY in .env.local (get one at https://tinypng.com/developers).",
        code: "missing_key",
      },
      500
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  const file = form.get("file");
  const convertTo = String(form.get("convertTo") || "");
  const resizeMethod = String(form.get("resizeMethod") || "");
  const resizeWidth = parseDim(form.get("resizeWidth"));
  const resizeHeight = parseDim(form.get("resizeHeight"));

  if (!(file instanceof File)) {
    return json({ error: "No file found." }, 400);
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return json(
      { error: `Unsupported format: ${file.type || "unknown"}` },
      400
    );
  }
  if (file.size > MAX_SIZE) {
    return json({ error: "File exceeds 30MB." }, 400);
  }

  const originalSize = file.size;
  const inputBuffer = Buffer.from(await file.arrayBuffer());

  // Set the key then create the source immediately (synchronously, no await in between)
  tinify.key = apiKey;

  try {
    let source = tinify.fromBuffer(inputBuffer);

    const resizeOpts = buildResizeOptions(
      resizeMethod,
      resizeWidth,
      resizeHeight
    );
    if (resizeOpts) {
      source = source.resize(resizeOpts);
    }

    let outType = file.type;
    if (convertTo && CONVERT_TYPES.has(convertTo) && convertTo !== file.type) {
      source = source.convert({
        type: convertTo as "image/png" | "image/jpeg" | "image/webp",
      });
      outType = convertTo;
    }

    const resultBuffer = Buffer.from(await source.toBuffer());

    return new Response(new Uint8Array(resultBuffer), {
      status: 200,
      headers: {
        "Content-Type": outType,
        "X-Original-Size": String(originalSize),
        "X-Compressed-Size": String(resultBuffer.length),
        "X-Output-Type": outType,
        "X-Compression-Count": String(tinify.compressionCount ?? ""),
        "X-Compression-Limit": String(FREE_LIMIT),
      },
    });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}

function parseDim(v: FormDataEntryValue | null): number | null {
  const n = Number(v);
  if (!v || !Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

function buildResizeOptions(
  method: string,
  width: number | null,
  height: number | null
): { method: string; width?: number; height?: number } | null {
  if (!RESIZE_METHODS.has(method)) return null;
  if (method === "scale") {
    if (width && !height) return { method, width };
    if (height && !width) return { method, height };
    return null;
  }
  if (width && height) return { method, width, height };
  return null;
}

// Account/quota error => code "account" + status 402 so the frontend knows to rotate keys
function errorResponse(err: unknown) {
  if (err instanceof tinify.AccountError) {
    return json(
      {
        error: "Invalid API key or this month's quota has been exhausted.",
        code: "account",
      },
      402
    );
  }
  if (err instanceof tinify.ClientError) {
    return json({ error: "Invalid image file or it could not be compressed." }, 400);
  }
  if (err instanceof tinify.ServerError) {
    return json({ error: "The TinyPNG server is having issues, please try again later." }, 502);
  }
  if (err instanceof tinify.ConnectionError) {
    return json({ error: "Could not connect to TinyPNG. Check your network." }, 502);
  }
  return json(
    { error: err instanceof Error ? err.message : "Unknown error." },
    500
  );
}

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
