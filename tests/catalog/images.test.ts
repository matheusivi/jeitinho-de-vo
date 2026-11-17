import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ImageError, imageUrl, processProductImage } from "@/lib/catalog/images";

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "jdv-img-"));
  process.env.UPLOAD_DIR = dir;
});
afterAll(() => rm(dir, { recursive: true, force: true }));

/** Foto deitada 1200x800, metade esquerda vermelha e direita azul, marcada no EXIF como "girar 90°". */
async function fotoDeCelular(): Promise<Buffer> {
  const half = (r: number, b: number) =>
    sharp({ create: { width: 600, height: 800, channels: 3, background: { r, g: 0, b } } }).png().toBuffer();
  return sharp({ create: { width: 1200, height: 800, channels: 3, background: "#000" } })
    .composite([
      { input: await half(255, 0), left: 0, top: 0 },
      { input: await half(0, 255), left: 600, top: 0 },
    ])
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
}

describe("processProductImage", () => {
  it("gera WebP quadrado em 480 e 960, leve e com a orientação aplicada @spec:AC-024", async () => {
    const { key } = await processProductImage(await fotoDeCelular());
    for (const size of [480, 960] as const) {
      const file = path.join(dir, `${key}-${size}.webp`);
      const meta = await sharp(file).metadata();
      expect(meta.format).toBe("webp");
      expect([meta.width, meta.height]).toEqual([size, size]);
      expect((await stat(file)).size).toBeLessThan(150 * 1024);
    }
    const { data, info } = await sharp(await readFile(path.join(dir, `${key}-480.webp`)))
      .raw()
      .toBuffer({ resolveWithObject: true });
    const px = (x: number, y: number) => data.subarray((y * info.width + x) * info.channels).subarray(0, 3);
    const top = px(240, 5);
    const bottom = px(240, 474);
    expect(top[0]).toBeGreaterThan(200); // vermelho em cima
    expect(bottom[2]).toBeGreaterThan(200); // azul embaixo
  });

  it("recusa arquivo que não é imagem, mesmo com cara de JPEG @spec:AC-025", async () => {
    await expect(processProductImage(Buffer.from("isto é um texto, não uma foto"))).rejects.toMatchObject({
      code: "TIPO",
    });
  });

  it("recusa formatos fora de JPEG, PNG e WebP", async () => {
    const gif = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#fff" } }).gif().toBuffer();
    await expect(processProductImage(gif)).rejects.toBeInstanceOf(ImageError);
  });

  it("recusa arquivo acima de 10 MB", async () => {
    await expect(processProductImage(Buffer.alloc(11 * 1024 * 1024))).rejects.toMatchObject({ code: "TAMANHO" });
  });

  it("monta a URL pública", () => {
    expect(imageUrl("abc", 480)).toBe("/midia/abc-480.webp");
  });
});
