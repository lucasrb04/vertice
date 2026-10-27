import { getEnv } from "@/env";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    getEnv();
  }
}
