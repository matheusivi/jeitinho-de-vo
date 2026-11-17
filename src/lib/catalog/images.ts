import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export const IMAGE_SIZES = [480, 960] as const;
export type ImageSize = (typeof IMAGE_SIZES)[number];
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set(["jpeg", "png", "webp"]);

export class ImageError extends Error {
  constructor(public code: "TIPO" | "TAMANHO") {
    super(code === "TIPO" ? "Envie uma foto em JPG, PNG ou WebP." : "A foto passa de 10 MB.");
    this.name = "ImageError";
  }
}

export function uploadDir(): string {
  return path.resolve(process.env.UPLOAD_DIR || "./uploads");
}

/** Recorta em quadrado, reduz e converte a foto do produto. Devolve a chave dos arquivos gerados. */
export async function processProductImage(buffer: Buffer): Promise<{ key: string }> {
  if (buffer.byteLength > MAX_BYTES) throw new ImageError("TAMANHO");
  let format: string | undefined;
  try {
    format = (await sharp(buffer).metadata()).format;
  } catch {
    throw new ImageError("TIPO");
  }
  if (!format || !ALLOWED.has(format)) throw new ImageError("TIPO");

  const key = randomBytes(16).toString("hex");
  const dir = uploadDir();
  await mkdir(dir, { recursive: true });
  try {
    for (const size of IMAGE_SIZES) {
      await sharp(buffer)
        .rotate()
        .resize(size, size, { fit: "cover", position: sharp.strategy.attention })
        .webp({ quality: 80 })
        .toFile(path.join(dir, `${key}-${size}.webp`));
    }
  } catch {
    throw new ImageError("TIPO");
  }
  return { key };
}

export function imageUrl(key: string, size: ImageSize): string {
  return `/midia/${key}-${size}.webp`;
}
