/**
 * Maps & Geocoding Client
 *
 * Provides location search, geocoding, and reverse-geocoding via the
 * OpenStreetMap Nominatim API (no key required) with an optional
 * Google Maps Geocoding API upgrade when GOOGLE_MAPS_API_KEY is set.
 *
 * Environment variables (all optional):
 *   GOOGLE_MAPS_API_KEY — enables Google Maps Geocoding, Places, and Directions
 *
 * Nominatim usage policy: https://operations.osmfoundation.org/policies/nominatim/
 * (max 1 req/s for automated use — acceptable for a conversational assistant)
 */

const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";
const GOOGLE_GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const GOOGLE_PLACES_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json";
const GOOGLE_DIRECTIONS_URL = "https://maps.googleapis.com/maps/api/directions/json";

const USER_AGENT = "CompanionOS/1.0 (companion assistant; contact via GitHub)";

// ── Nominatim helpers ────────────────────────────────────────────────────────

/**
 * Geocode an address string to coordinates using Nominatim.
 *
 * @param {string} address
 * @returns {Promise<{lat: number, lon: number, displayName: string} | null>}
 */
async function nominatimGeocode(address) {
  const url = new URL(`${NOMINATIM_BASE_URL}/search`);
  url.searchParams.set("q", address);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!res.ok) throw new Error(`Nominatim geocode error: ${res.status}`);

  const data = await res.json();
  if (!data || data.length === 0) return null;

  const item = data[0];
  return {
    lat: parseFloat(item.lat),
    lon: parseFloat(item.lon),
    displayName: item.display_name,
    type: item.type,
    importance: item.importance,
  };
}

/**
 * Reverse-geocode coordinates to an address using Nominatim.
 *
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<{displayName: string, address: object} | null>}
 */
async function nominatimReverseGeocode(lat, lon) {
  const url = new URL(`${NOMINATIM_BASE_URL}/reverse`);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!res.ok) throw new Error(`Nominatim reverse geocode error: ${res.status}`);

  const data = await res.json();
  if (!data || data.error) return null;

  return {
    displayName: data.display_name,
    address: data.address,
  };
}

/**
 * Search for places using Nominatim.
 *
 * @param {string} query
 * @param {number} [limit]
 * @returns {Promise<{name: string, displayName: string, lat: number, lon: number, type: string}[]>}
 */
async function nominatimSearchPlaces(query, limit = 5) {
  const url = new URL(`${NOMINATIM_BASE_URL}/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("addressdetails", "1");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!res.ok) throw new Error(`Nominatim place search error: ${res.status}`);

  const data = await res.json();
  return (data ?? []).map((item) => ({
    name: item.name || item.display_name.split(",")[0],
    displayName: item.display_name,
    lat: parseFloat(item.lat),
    lon: parseFloat(item.lon),
    type: item.type,
  }));
}

// ── Google Maps helpers ──────────────────────────────────────────────────────

/**
 * Geocode an address using the Google Maps Geocoding API.
 *
 * @param {string} address
 * @param {string} apiKey
 * @returns {Promise<{lat: number, lon: number, displayName: string} | null>}
 */
async function googleGeocode(address, apiKey) {
  const url = new URL(GOOGLE_GEOCODE_URL);
  url.searchParams.set("address", address);
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Google Geocoding API error: ${res.status}`);

  const data = await res.json();
  if (data.status !== "OK" || !data.results || data.results.length === 0) return null;

  const loc = data.results[0].geometry.location;
  return {
    lat: loc.lat,
    lon: loc.lng,
    displayName: data.results[0].formatted_address,
  };
}

/**
 * Search for places using the Google Maps Places API.
 *
 * @param {string} query
 * @param {string} apiKey
 * @param {number} [limit]
 * @returns {Promise<{name: string, displayName: string, lat: number, lon: number, types: string[]}[]>}
 */
async function googleSearchPlaces(query, apiKey, limit = 5) {
  const url = new URL(GOOGLE_PLACES_URL);
  url.searchParams.set("query", query);
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Google Places API error: ${res.status}`);

  const data = await res.json();
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    throw new Error(`Google Places API status: ${data.status}`);
  }

  return (data.results ?? []).slice(0, limit).map((item) => ({
    name: item.name,
    displayName: `${item.name}, ${item.formatted_address}`,
    lat: item.geometry.location.lat,
    lon: item.geometry.location.lng,
    types: item.types ?? [],
    rating: item.rating,
    address: item.formatted_address,
  }));
}

/**
 * Get directions between two locations using Google Maps Directions API.
 *
 * @param {string} origin
 * @param {string} destination
 * @param {string} apiKey
 * @param {string} [mode] — driving | walking | bicycling | transit
 * @returns {Promise<{summary: string, distance: string, duration: string, steps: string[]} | null>}
 */
async function googleDirections(origin, destination, apiKey, mode = "driving") {
  const url = new URL(GOOGLE_DIRECTIONS_URL);
  url.searchParams.set("origin", origin);
  url.searchParams.set("destination", destination);
  url.searchParams.set("mode", mode);
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Google Directions API error: ${res.status}`);

  const data = await res.json();
  if (data.status !== "OK" || !data.routes || data.routes.length === 0) return null;

  const route = data.routes[0];
  const leg = route.legs[0];

  // Strip basic HTML tags from Google's html_instructions field.
  // Handles common inline tags (b, div, wbr) that Google injects; complex
  // or malformed markup may not be fully stripped but is safe to ignore here.
  const steps = (leg.steps ?? []).map((s) =>
    s.html_instructions.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
  );

  return {
    summary: route.summary,
    distance: leg.distance?.text ?? "",
    duration: leg.duration?.text ?? "",
    steps,
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Geocode an address to coordinates.
 * Uses Google Maps when GOOGLE_MAPS_API_KEY is set, otherwise Nominatim.
 *
 * @param {string} address
 * @returns {Promise<{lat: number, lon: number, displayName: string} | null>}
 */
export async function geocodeAddress(address) {
  const googleKey = process.env.GOOGLE_MAPS_API_KEY;
  if (googleKey) {
    return googleGeocode(address, googleKey);
  }
  return nominatimGeocode(address);
}

/**
 * Reverse-geocode coordinates to a human-readable address (Nominatim only).
 *
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<{displayName: string, address: object} | null>}
 */
export async function reverseGeocode(lat, lon) {
  return nominatimReverseGeocode(lat, lon);
}

/**
 * Search for places matching a query.
 * Uses Google Maps when GOOGLE_MAPS_API_KEY is set, otherwise Nominatim.
 *
 * @param {string} query
 * @param {number} [limit]
 * @returns {Promise<{name: string, displayName: string, lat: number, lon: number}[]>}
 */
export async function searchPlaces(query, limit = 5) {
  const googleKey = process.env.GOOGLE_MAPS_API_KEY;
  if (googleKey) {
    return googleSearchPlaces(query, googleKey, limit);
  }
  return nominatimSearchPlaces(query, limit);
}

/**
 * Get directions between two locations (requires GOOGLE_MAPS_API_KEY).
 *
 * @param {string} origin
 * @param {string} destination
 * @param {string} [mode] — driving | walking | bicycling | transit
 * @returns {Promise<{summary: string, distance: string, duration: string, steps: string[]} | null>}
 */
export async function getDirections(origin, destination, mode = "driving") {
  const googleKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!googleKey) {
    console.warn("GOOGLE_MAPS_API_KEY not set — directions unavailable.");
    return null;
  }
  return googleDirections(origin, destination, googleKey, mode);
}

/**
 * Format geocoding result for injection into an AI prompt.
 *
 * @param {string} query
 * @param {{lat: number, lon: number, displayName: string} | null} result
 * @returns {string}
 */
export function formatGeocodingResult(query, result) {
  if (!result) return `Could not find location for: "${query}"`;
  return `Location for "${query}":\n  ${result.displayName}\n  Coordinates: ${result.lat}, ${result.lon}`;
}

/**
 * Format place-search results for injection into an AI prompt.
 *
 * @param {string} query
 * @param {{name: string, displayName: string, lat: number, lon: number}[]} results
 * @returns {string}
 */
export function formatPlacesResults(query, results) {
  if (!results || results.length === 0) {
    return `No places found for: "${query}"`;
  }

  const lines = results.map((p, i) => {
    const parts = [
      `${i + 1}. ${p.name}`,
      `   ${p.displayName}`,
      `   Coords: ${p.lat}, ${p.lon}`,
    ];
    if (p.rating) parts.push(`   Rating: ${p.rating}`);
    return parts.join("\n");
  });

  return `Places matching "${query}":\n\n${lines.join("\n\n")}`;
}

/**
 * Format directions result for injection into an AI prompt.
 *
 * @param {string} origin
 * @param {string} destination
 * @param {{summary: string, distance: string, duration: string, steps: string[]} | null} result
 * @returns {string}
 */
export function formatDirections(origin, destination, result) {
  if (!result) return `Could not get directions from "${origin}" to "${destination}".`;

  const stepLines = result.steps.map((s, i) => `  ${i + 1}. ${s}`).join("\n");
  return `Directions from "${origin}" to "${destination}" (${result.summary}):
  Distance: ${result.distance}
  Duration: ${result.duration}

Steps:
${stepLines}`;
}
