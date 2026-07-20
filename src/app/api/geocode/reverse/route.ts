import { NextResponse } from "next/server";

export const runtime = "nodejs";

type NominatimReverse = {
  place_id: number;
  osm_type?: string;
  osm_id?: number;
  display_name: string;
  name?: string;
  lat: string;
  lon: string;
};

/**
 * Proxy Nominatim reverse geocode (free OSM).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "invalid_coords" }, { status: 400 });
  }

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "0");

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "NSLAW-Work-Manager/1.0 (internal; reverse geocode)",
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "geocode_failed" }, { status: 502 });
    }

    const data = (await res.json()) as NominatimReverse & { error?: string };
    if (data.error || !data.display_name) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const address = data.display_name;
    const name =
      data.name?.trim() ||
      address.split(",")[0]?.trim() ||
      address;
    const placeId =
      data.osm_type && data.osm_id != null
        ? `osm:${data.osm_type}:${data.osm_id}`
        : `nominatim:${data.place_id}`;

    return NextResponse.json({
      result: {
        name,
        address,
        placeId,
        lat: Number(data.lat) || lat,
        lng: Number(data.lon) || lng,
      },
    });
  } catch {
    return NextResponse.json({ error: "geocode_failed" }, { status: 502 });
  }
}
