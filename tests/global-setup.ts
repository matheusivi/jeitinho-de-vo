import "dotenv/config";
import { runMigrations } from "../src/db/migrate";

export default async function setup() {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error("DATABASE_URL_TEST não configurada");
  await runMigrations(url);
}
