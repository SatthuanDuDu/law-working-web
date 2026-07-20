export type LocationValue = {
  name: string;
  address: string;
  placeId: string | null;
  lat: number;
  lng: number;
};

export function locationDisplayLabel(loc: LocationValue): string {
  return loc.name.trim() || loc.address.trim() || "Location";
}

export function hasLocationCoords(
  loc: Pick<LocationValue, "lat" | "lng"> | null | undefined,
): loc is Pick<LocationValue, "lat" | "lng"> {
  return (
    loc != null &&
    Number.isFinite(loc.lat) &&
    Number.isFinite(loc.lng)
  );
}

/** Parse location fields from FormData. Returns null if cleared / incomplete. */
export function parseLocationFromFormData(
  formData: FormData,
): LocationValue | null {
  if (formData.get("locationCleared") === "1") return null;

  const name = String(formData.get("locationName") ?? "").trim();
  const address = String(formData.get("locationAddress") ?? "").trim();
  const placeIdRaw = String(formData.get("locationPlaceId") ?? "").trim();
  const latRaw = String(formData.get("locationLat") ?? "").trim();
  const lngRaw = String(formData.get("locationLng") ?? "").trim();

  if (!latRaw || !lngRaw) return null;
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (!name && !address && !placeIdRaw) return null;

  return {
    name: name || address,
    address: address || name,
    placeId: placeIdRaw || null,
    lat,
    lng,
  };
}

export function locationToPrismaFields(loc: LocationValue | null) {
  if (!loc) {
    return {
      locationName: null,
      locationAddress: null,
      locationPlaceId: null,
      locationLat: null,
      locationLng: null,
    };
  }
  return {
    locationName: loc.name,
    locationAddress: loc.address,
    locationPlaceId: loc.placeId,
    locationLat: loc.lat,
    locationLng: loc.lng,
  };
}

export function appendLocationToFormData(
  formData: FormData,
  loc: LocationValue | null,
) {
  if (!loc) {
    formData.set("locationCleared", "1");
    formData.set("locationName", "");
    formData.set("locationAddress", "");
    formData.set("locationPlaceId", "");
    formData.set("locationLat", "");
    formData.set("locationLng", "");
    return;
  }
  formData.set("locationCleared", "0");
  formData.set("locationName", loc.name);
  formData.set("locationAddress", loc.address);
  formData.set("locationPlaceId", loc.placeId ?? "");
  formData.set("locationLat", String(loc.lat));
  formData.set("locationLng", String(loc.lng));
}

/** Free OSM embed — no API key. */
export function openStreetMapEmbedUrl(loc: LocationValue, delta = 0.01): string {
  const { lat, lng } = loc;
  const left = lng - delta;
  const right = lng + delta;
  const top = lat + delta;
  const bottom = lat - delta;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${lat}%2C${lng}`;
}

/** Open full OSM map in a new tab. */
export function openStreetMapExternalUrl(loc: LocationValue): string {
  return `https://www.openstreetmap.org/?mlat=${loc.lat}&mlon=${loc.lng}#map=16/${loc.lat}/${loc.lng}`;
}

/** Google Maps view link (no API key required for this URL). */
export function googleMapsExternalUrl(loc: LocationValue): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(`${loc.lat},${loc.lng}`)}`;
}

export function locationFromPrismaFields(fields: {
  locationName: string | null;
  locationAddress: string | null;
  locationPlaceId: string | null;
  locationLat: number | null;
  locationLng: number | null;
}): LocationValue | null {
  if (
    fields.locationLat == null ||
    fields.locationLng == null ||
    !Number.isFinite(fields.locationLat) ||
    !Number.isFinite(fields.locationLng)
  ) {
    return null;
  }
  return {
    name: fields.locationName ?? fields.locationAddress ?? "",
    address: fields.locationAddress ?? fields.locationName ?? "",
    placeId: fields.locationPlaceId,
    lat: fields.locationLat,
    lng: fields.locationLng,
  };
}
