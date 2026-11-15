// lib/tutor/form.ts — one request body for the handlers: JSON, or multipart with a photo (G3).
import { MAX_UPLOAD_BYTES } from "@/lib/images";

export const TOO_BIG = { tooBig: true } as const;

/** JSON body, or multipart: text fields as strings, the photo (`image`) as bytes. A photo over 4 MB → TOO_BIG. */
export async function readBody(req: Request): Promise<unknown> {
  const type = req.headers.get("content-type") ?? "";
  if (!type.startsWith("multipart/form-data")) return req.json().catch(() => null);
  const form = await req.formData().catch(() => null);
  if (!form) return null;
  const out: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") out[key] = value;
    else if (key === "image") {
      if (value.size > MAX_UPLOAD_BYTES) return TOO_BIG;
      out.image = new Uint8Array(await value.arrayBuffer());
    }
  }
  return out;
}

export const isTooBig = (b: unknown): b is typeof TOO_BIG => typeof b === "object" && b !== null && (b as { tooBig?: unknown }).tooBig === true;
