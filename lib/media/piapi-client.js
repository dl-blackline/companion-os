const PIAPI_BASE_URL = "https://api.piapi.ai";

export async function piapiFetch(path, body) {
  const response = await fetch(`${PIAPI_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.PIAPI_API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`PiAPI request failed (${response.status}): ${error}`);
  }

  return response.json();
}

export async function piapiGet(path) {
  const response = await fetch(`${PIAPI_BASE_URL}${path}`, {
    method: "GET",
    headers: {
      "x-api-key": process.env.PIAPI_API_KEY,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`PiAPI poll failed (${response.status}): ${error}`);
  }

  return response.json();
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const POLL_INTERVAL_MS = 5000;
export const MAX_POLL_ATTEMPTS = 60;
