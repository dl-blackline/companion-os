/**
 * Unified response contract helpers.
 *
 * Every Netlify function endpoint should return responses through these helpers
 * so that consumers always receive a consistent JSON envelope:
 *
 *   Success → { success: true, data: { … } }
 *   Failure → { success: false, error: "…", code: "…" }
 *
 * The helpers also attach standard CORS headers and serialize the body.
 */

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/**
 * Build a success response.
 *
 * @param {object} data                - Payload to return.
 * @param {number} [statusCode=200]    - HTTP status code.
 * @param {object} [extraHeaders]      - Additional headers to merge.
 * @returns {{ statusCode: number, headers: object, body: string }}
 */
export function ok(data, statusCode = 200, extraHeaders) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, ...extraHeaders },
    body: JSON.stringify({ success: true, data }),
  };
}

/**
 * Build an error response.
 *
 * @param {string} error               - Human-readable error message.
 * @param {string} [code="ERR_UNKNOWN"] - Machine-readable error code.
 * @param {number} [statusCode=500]    - HTTP status code.
 * @param {object} [extraHeaders]      - Additional headers to merge.
 * @returns {{ statusCode: number, headers: object, body: string }}
 */
export function fail(error, code = "ERR_UNKNOWN", statusCode = 500, extraHeaders) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, ...extraHeaders },
    body: JSON.stringify({ success: false, error, code }),
  };
}

/**
 * Standard CORS preflight response for OPTIONS requests.
 *
 * @returns {{ statusCode: number, headers: object, body: string }}
 */
export function preflight() {
  return { statusCode: 204, headers: CORS_HEADERS, body: "" };
}

/**
 * Build a raw response (e.g. for streaming) without the envelope.
 * Use sparingly — prefer ok() / fail() for consistency.
 *
 * @param {number} statusCode
 * @param {object} body
 * @param {object} [extraHeaders]
 * @returns {{ statusCode: number, headers: object, body: string }}
 */
export function raw(statusCode, body, extraHeaders) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, ...extraHeaders },
    body: JSON.stringify(body),
  };
}

// ── Streaming-ready response helpers ────────────────────────────────────────

/**
 * SSE (Server-Sent Events) headers for streaming endpoints.
 */
export const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/**
 * Supported AI processing states for streaming responses.
 *
 * Endpoints can include `ai_state` in their response to communicate
 * the current processing phase to clients:
 *
 *   thinking   — AI is processing the request (context assembly, planning)
 *   responding — AI is generating tokens / streaming content
 *   done       — Processing complete, final response available
 *
 * @type {Readonly<{ THINKING: "thinking", RESPONDING: "responding", DONE: "done" }>}
 */
export const AI_STATE = Object.freeze({
  THINKING: "thinking",
  RESPONDING: "responding",
  DONE: "done",
});

/**
 * Build a streaming-ready success response that includes AI state metadata.
 *
 * @param {object} data               - Payload to return.
 * @param {string} [aiState="done"]   - Current AI processing state.
 * @param {number} [statusCode=200]   - HTTP status code.
 * @param {object} [extraHeaders]     - Additional headers to merge.
 * @returns {{ statusCode: number, headers: object, body: string }}
 */
export function okStream(data, aiState = AI_STATE.DONE, statusCode = 200, extraHeaders) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, ...extraHeaders },
    body: JSON.stringify({ success: true, data, ai_state: aiState }),
  };
}

/**
 * Build a streaming-capable success response.
 *
 * When `isStreaming` is false the response is a normal JSON envelope.
 * When `isStreaming` is true the response includes `streaming: true` and
 * `partial: true` flags so the client knows to expect partial updates.
 *
 * @param {object}  data
 * @param {object}  [opts]
 * @param {boolean} [opts.isStreaming=false]  - Whether this is a partial streaming chunk.
 * @param {string}  [opts.aiState]           - Current AI processing state.
 * @param {number}  [opts.statusCode=200]
 * @param {object}  [opts.extraHeaders]
 * @returns {{ statusCode: number, headers: object, body: string }}
 */
export function okMaybe(data, { isStreaming = false, aiState, statusCode = 200, extraHeaders } = {}) {
  const payload = { success: true, data };
  if (isStreaming) {
    payload.streaming = true;
    payload.partial = true;
  }
  if (aiState) {
    payload.ai_state = aiState;
  }
  return {
    statusCode,
    headers: { ...CORS_HEADERS, ...extraHeaders },
    body: JSON.stringify(payload),
  };
}

export { CORS_HEADERS };
