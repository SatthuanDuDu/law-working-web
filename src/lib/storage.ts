import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function isUsableHttpUrl(value: string | undefined): value is string {
  if (!value?.trim()) return false;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    // Browser uploads must not target local MinIO from Vercel.
    if (
      process.env.VERCEL &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1")
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function getS3Config() {
  const endpoint = requireEnv("S3_ENDPOINT");
  const publicRaw = process.env.S3_PUBLIC_ENDPOINT?.trim();
  const publicEndpoint = isUsableHttpUrl(publicRaw) ? publicRaw : endpoint;

  return {
    endpoint,
    publicEndpoint,
    bucket: requireEnv("S3_BUCKET"),
    region: process.env.S3_REGION?.trim() || "auto",
    accessKeyId: requireEnv("S3_ACCESS_KEY"),
    secretAccessKey: requireEnv("S3_SECRET_KEY"),
  };
}

function createClient(endpoint: string) {
  const config = getS3Config();
  return new S3Client({
    region: config.region,
    endpoint,
    // Required for MinIO and Cloudflare R2 path-style URLs
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

export function buildStorageKey(fileName: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `attachments/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
}

export function buildAvatarStorageKey(userId: string, fileName: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `avatars/${userId}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
}

/** Browser-facing signed URLs (upload/download/preview). */
function signingEndpoint() {
  return getS3Config().publicEndpoint;
}

/** Server-side API calls to the bucket. */
function apiEndpoint() {
  return getS3Config().endpoint;
}

export async function createUploadUrl(storageKey: string, mimeType: string) {
  const config = getS3Config();
  const client = createClient(signingEndpoint());
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: storageKey,
    ContentType: mimeType,
  });
  return getSignedUrl(client, command, { expiresIn: 60 * 10 });
}

export async function createDownloadUrl(storageKey: string, fileName: string) {
  const config = getS3Config();
  const client = createClient(signingEndpoint());
  const command = new GetObjectCommand({
    Bucket: config.bucket,
    Key: storageKey,
    ResponseContentDisposition: `attachment; filename="${encodeURIComponent(fileName)}"`,
  });
  return getSignedUrl(client, command, { expiresIn: 60 * 5 });
}

export async function createPreviewUrl(
  storageKey: string,
  fileName: string,
  mimeType: string,
) {
  const config = getS3Config();
  const client = createClient(signingEndpoint());
  const command = new GetObjectCommand({
    Bucket: config.bucket,
    Key: storageKey,
    ResponseContentDisposition: `inline; filename="${encodeURIComponent(fileName)}"`,
    ResponseContentType: mimeType || "application/octet-stream",
  });
  return getSignedUrl(client, command, { expiresIn: 60 * 5 });
}

/**
 * Fetch object bytes from storage via the internal API endpoint.
 * Used to proxy preview/download same-origin (browser never talks to MinIO/R2 directly).
 */
export async function getObjectStream(storageKey: string) {
  const config = getS3Config();
  const client = createClient(apiEndpoint());
  const result = await client.send(
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: storageKey,
    }),
  );

  if (!result.Body) {
    throw new Error("Empty object body");
  }

  return {
    body: result.Body.transformToWebStream(),
    contentType: result.ContentType || "application/octet-stream",
    contentLength: result.ContentLength,
  };
}

/** Same-origin server upload — avoids browser→R2 CORS on Vercel. */
export async function uploadObject(
  storageKey: string,
  body: Buffer | Uint8Array,
  mimeType: string,
) {
  const config = getS3Config();
  const client = createClient(apiEndpoint());
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: storageKey,
      Body: body,
      ContentType: mimeType,
    }),
  );
}

export async function deleteObject(storageKey: string) {
  const config = getS3Config();
  const client = createClient(apiEndpoint());
  await client.send(
    new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: storageKey,
    }),
  );
}

/**
 * Same-origin upload proxy max.
 * Vercel serverless body limit is ~4.5MB; self-hosted (VPS) can take full
 * attachment max (25MB) so MinIO stays private (no public S3 hostname).
 */
export const PROXY_UPLOAD_MAX_BYTES = process.env.VERCEL
  ? 4 * 1024 * 1024
  : 25 * 1024 * 1024;
