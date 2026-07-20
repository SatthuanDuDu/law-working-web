/** Normalize login / username: lowercase, trim. */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Allowed: a-z, 0-9, `.` separator.
 * Must contain at least one `.` and be 8–32 chars (e.g. vinh.tran).
 */
export const USERNAME_REGEX = /^[a-z0-9]+\.[a-z0-9]+(?:\.[a-z0-9]+)*$/;

export function isValidUsername(raw: string): boolean {
  const value = normalizeUsername(raw);
  return value.length >= 8 && value.length <= 32 && USERNAME_REGEX.test(value);
}

/** Strip Vietnamese diacritics (including đ/Đ). */
export function removeVietnameseDiacritics(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d");
}

function tokenizeFullName(fullName: string): string[] {
  return removeVietnameseDiacritics(fullName)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function clampUsername(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, "")
    .replace(/\.+/g, ".")
    .replace(/^\.|\.$/g, "")
    .slice(0, 32);
}

/** Ambiguous-safe alphabet for padding / random suffixes (no 0/o/1/l/i). */
const RANDOM_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";

function randomAlphanumeric(length: number): string {
  let out = "";
  const bytes =
    typeof crypto !== "undefined" && "getRandomValues" in crypto
      ? crypto.getRandomValues(new Uint8Array(length))
      : Uint8Array.from({ length }, () => Math.floor(Math.random() * 256));
  for (let i = 0; i < length; i += 1) {
    out += RANDOM_ALPHABET[bytes[i]! % RANDOM_ALPHABET.length];
  }
  return out;
}

/**
 * Force dotted username with length >= 8.
 * Pads the right side deterministically from existing letters when short
 * (e.g. "an.le" → "an.leanl"), so UI auto-fill stays stable.
 */
function ensureDottedUsername(value: string): string {
  let v = clampUsername(value);
  if (!v.includes(".")) {
    const left = (v || "user").slice(0, 28);
    v = clampUsername(`${left}.${left[0] || "u"}`);
  }

  if (v.length < 8) {
    const [left = "user", ...rest] = v.split(".");
    let right = rest.join("") || left[0] || "u";
    const seed = `${left}${right}`;
    let i = 0;
    while (`${left}.${right}`.length < 8 && i < 32) {
      right += seed[i % seed.length] || "x";
      i += 1;
    }
    v = clampUsername(`${left}.${right}`);
  }

  if (!v.includes(".") || v.length < 8) {
    v = clampUsername(`user.${randomAlphanumeric(4)}`);
  }
  return v.slice(0, 32);
}

/**
 * Candidates shortest → longer (always with `.`, length ≥ 8).
 * "Trần Công Vinh" → ["vinh.tran", "vinh.tc", "vinh.trancong", ...]
 * (skips forms shorter than 8 like "vinh.t")
 */
export function buildUsernameCandidatesFromFullName(fullName: string): string[] {
  const parts = tokenizeFullName(fullName);
  if (parts.length === 0) return [];

  const given = parts[parts.length - 1];
  const familyParts = parts.slice(0, -1);
  const family = familyParts[0] ?? "";
  const middle = familyParts.slice(1);

  const candidates: string[] = [];
  const push = (raw: string) => {
    // Prefer natural forms that already meet length; only pad as last resort
    const clamped = clampUsername(raw);
    const value =
      clamped.includes(".") && clamped.length >= 8
        ? clamped.slice(0, 32)
        : ensureDottedUsername(raw);
    if (
      value.length >= 8 &&
      value.length <= 32 &&
      value.includes(".") &&
      !candidates.includes(value)
    ) {
      candidates.push(value);
    }
  };

  if (family) {
    // Prefer full family name first when it yields ≥ 8 chars (vinh.tran)
    push(`${given}.${family}`);
    // Only add initial form if it already reaches 8 without heavy padding
    const short = clampUsername(`${given}.${family[0]}`);
    if (short.length >= 8) push(short);
  } else {
    push(`${given}.${given[0] || "u"}`);
  }

  if (familyParts.length > 0) {
    const initials = familyParts.map((p) => p[0]).join("");
    push(`${given}.${initials}`);
    push(`${given}.${familyParts.join("")}`);
  }
  if (middle.length > 0 && family) {
    push(`${given}.${family}${middle.map((m) => m[0]).join("")}`);
  }

  if (candidates.length === 0) {
    push(`${given || "user"}.${family || given || "u"}`);
  }

  return candidates;
}

/**
 * Preferred username for UI auto-fill (shortest dotted, ≥ 8 chars).
 * Example: "Trần Công Vinh" → "vinh.tran"
 */
export function generateUsernameFromFullName(fullName: string): string {
  return buildUsernameCandidatesFromFullName(fullName)[0] ?? "";
}

/**
 * Unique username (always with `.`, length ≥ 8):
 * 1) preferred / name candidates
 * 2) if taken → left.random padded to ≥ 8 (e.g. vinh.7kx)
 */
export async function allocateUniqueUsername(options: {
  fullName: string;
  preferred?: string | null;
  isTaken: (username: string) => Promise<boolean>;
}): Promise<string | null> {
  const preferred = options.preferred?.trim()
    ? ensureDottedUsername(options.preferred)
    : "";
  const fromName = buildUsernameCandidatesFromFullName(options.fullName);

  const ordered: string[] = [];
  const push = (value: string) => {
    const v = ensureDottedUsername(value);
    if (
      v.length >= 8 &&
      v.length <= 32 &&
      v.includes(".") &&
      !ordered.includes(v)
    ) {
      ordered.push(v);
    }
  };

  if (options.preferred?.trim()) push(preferred);
  for (const c of fromName) push(c);

  if (ordered.length === 0) {
    push(`user.${randomAlphanumeric(4)}`);
  }
  if (ordered.length === 0) return null;

  for (const candidate of ordered) {
    if (!(await options.isTaken(candidate))) return candidate;
  }

  const seed = ordered[0]!;
  const left = (seed.split(".")[0] || "user").slice(0, 28);
  for (let round = 0; round < 40; round += 1) {
    const suffixLen = Math.max(3, 8 - left.length - 1);
    const candidate = ensureDottedUsername(
      `${left}.${randomAlphanumeric(suffixLen + (round >= 20 ? 1 : 0))}`,
    );
    if (!(await options.isTaken(candidate))) return candidate.slice(0, 32);
  }

  return null;
}

/** @deprecated Prefer allocateUniqueUsername */
export function nextUsernameCandidate(base: string, attempt: number): string {
  const clean = ensureDottedUsername(base);
  if (attempt <= 0) return clean;
  const left = (clean.split(".")[0] || "user").slice(0, 28);
  if (attempt <= 9) {
    return ensureDottedUsername(`${left}.${attempt + 1}`);
  }
  return ensureDottedUsername(`${left}.${randomAlphanumeric(3)}`);
}

/** Derive a candidate username from email local-part (legacy / seed). */
export function deriveUsernameFromEmail(email: string): string {
  const local = email.split("@")[0]?.trim().toLowerCase() ?? "user";
  const cleaned = removeVietnameseDiacritics(local)
    .replace(/[^a-z0-9.]/g, ".")
    .replace(/\.+/g, ".")
    .replace(/^\.|\.$/g, "");
  return ensureDottedUsername(cleaned.slice(0, 24) || "user");
}

export const DEMO_ADMIN_USERNAME = "admin";
export const DEMO_ADMIN_EMAIL = "admin@admin.com";
export const DEMO_ADMIN_PASSWORD = "admin";
