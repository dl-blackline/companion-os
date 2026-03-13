/**
 * Web Search Client
 *
 * Provides real-time internet search via the Brave Search API.
 * Falls back gracefully when the API key is absent.
 *
 * Environment variables:
 *   BRAVE_SEARCH_API_KEY — Brave Search subscription token
 *                          (https://brave.com/search/api/)
 */

const BRAVE_BASE_URL = "https://api.search.brave.com/res/v1/web/search";

/**
 * Search the web using the Brave Search API.
 *
 * @param {string} query   — search query
 * @param {number} [count] — number of results to return (1-20, default 5)
 * @returns {Promise<{title: string, url: string, description: string}[]>}
 */
export async function searchWeb(query, count = 5) {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;

  if (!apiKey) {
    console.warn("BRAVE_SEARCH_API_KEY not set — web search unavailable.");
    return [];
  }

  const url = new URL(BRAVE_BASE_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(Math.min(20, Math.max(1, count))));
  url.searchParams.set("text_decorations", "false");
  url.searchParams.set("search_lang", "en");

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Brave Search API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  const results = (data?.web?.results ?? []).map((item) => ({
    title: item.title ?? "",
    url: item.url ?? "",
    description: item.description ?? "",
  }));

  return results;
}

/**
 * Format web-search results into a concise text block suitable for
 * injection into an AI prompt.
 *
 * @param {string} query
 * @param {{title: string, url: string, description: string}[]} results
 * @returns {string}
 */
export function formatSearchResults(query, results) {
  if (!results || results.length === 0) {
    return `No web results found for: "${query}"`;
  }

  const lines = results.map(
    (r, i) => `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.description}`
  );

  return `Web search results for "${query}":\n\n${lines.join("\n\n")}`;
}
