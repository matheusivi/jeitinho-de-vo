import { readFile } from "node:fs/promises";
import path from "node:path";
import { uploadDir } from "@/lib/catalog/images";

const VALID = /^[a-f0-9]{32}-(480|960)\.webp$/;

export async function GET(_req: Request, ctx: { params: Promise<{ file: string }> }) {
  const { file } = await ctx.params;
  if (!VALID.test(file)) return new Response("Não encontrado", { status: 404 });
  try {
    const data = await readFile(path.join(uploadDir(), file));
    return new Response(new Uint8Array(data), {
      headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return new Response("Não encontrado", { status: 404 });
  }
}
