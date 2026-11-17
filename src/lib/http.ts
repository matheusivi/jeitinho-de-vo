import { headers } from "next/headers";
import { pickClientIp } from "./ip";

/** IP de quem fez a requisição, atrás do proxy do servidor. */
export async function clientIp(): Promise<string> {
  return pickClientIp(await headers());
}
