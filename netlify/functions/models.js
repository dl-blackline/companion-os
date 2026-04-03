import { MODEL_REGISTRY } from "../../lib/model-registry.js";
import { fail, preflight, raw } from "../../lib/_responses.js";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return preflight();
  }

  if (event.httpMethod !== "GET") {
    return fail("Method not allowed", "ERR_METHOD", 405);
  }

  return raw(200, MODEL_REGISTRY);
}
