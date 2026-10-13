import "server-only";

import { createServerClient } from "./server";

export async function getDatabaseStatus(): Promise<"connected" | "disconnected"> {
  try {
    const client = await createServerClient();
    if (!client) return "disconnected";
    const { error } = await client.from("funds").select("id", { head: true, count: "exact" });
    return error ? "disconnected" : "connected";
  } catch {
    return "disconnected";
  }
}
