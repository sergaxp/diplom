export interface GeoSuggestion {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string;
  timezone: string;
}

export async function fetchGeoSuggestions(query: string): Promise<GeoSuggestion[]> {
  if (query.trim().length < 2) return [];
  const params = new URLSearchParams({
    name: query.trim(), count: '6', language: 'ru', format: 'json',
  });
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`);
  if (!res.ok) return [];
  const json = await res.json();
  return json.results ?? [];
}
