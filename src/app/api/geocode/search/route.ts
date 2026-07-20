import { NextResponse } from "next/server";

export const runtime = "nodejs";

type NominatimItem = {
  place_id: number;
  osm_type?: string;
  osm_id?: number;
  display_name: string;
  name?: string;
  lat: string;
  lon: string;
};

/**
 * Proxy Nominatim search (free OSM geocoding).
 * Required: identifiable User-Agent per Nominatim usage policy.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "0");
  url.searchParams.set("limit", "6");
  url.searchParams.set("countrycodes", "vn");

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "NSLAW-Work-Manager/1.0 (internal; location search)",
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "geocode_failed", results: [] },
        { status: 502 },
      );
    }

    const data = (await res.json()) as NominatimItem[];
    const results = data.map((item) => {
      const lat = Number(item.lat);
      const lng = Number(item.lon);
      const address = item.display_name;
      const name =
        item.name?.trim() ||
        address.split(",")[0]?.trim() ||
        address;
      const placeId =
        item.osm_type && item.osm_id != null
          ? `osm:${item.osm_type}:${item.osm_id}`
          : `nominatim:${item.place_id}`;
      return { name, address, placeId, lat, lng };
    });

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json(
      { error: "geocode_failed", results: [] },
      { status: 502 },
    );
  }
}
