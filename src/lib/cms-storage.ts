import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Object storage for the public website media library (bucket nslaw-web).
 * Shares MinIO/R2 credentials with the workspace; bucket is overridden via CMS_S3_BUCKET.
 */

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function getCmsS3Config() {
  return {
    endpoint: requireEnv("S3_ENDPOINT"),
    publicEndpoint:
      process.env.S3_PUBLIC_ENDPOINT?.trim() || requireEnv("S3_ENDPOINT"),
    bucket:
      process.env.CMS_S3_BUCKET?.trim() ||
      process.env.WEB_S3_BUCKET?.trim() ||
      "nslaw-web",
    region: process.env.S3_REGION?.trim() || "auto",
    accessKeyId: requireEnv("S3_ACCESS_KEY"),
    secretAccessKey: requireEnv("S3_SECRET_KEY"),
  };
}

function createClient(endpoint: string) {
  const config = getCmsS3Config();
  return new S3Client({
    region: config.region,
    endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

export function buildCmsMediaKey(fileName: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `media/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
}

export async function createCmsUploadUrl(storageKey: string, mimeType: string) {
  const config = getCmsS3Config();
  const client = createClient(config.publicEndpoint);
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: storageKey,
    ContentType: mimeType,
  });
  return getSignedUrl(client, command, { expiresIn: 60 * 10 });
}

export async function deleteCmsObject(storageKey: string) {
  const config = getCmsS3Config();
  const client = createClient(config.endpoint);
  await client.send(
    new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: storageKey,
    }),
  );
}

export async function putCmsObject(
  storageKey: string,
  body: Buffer,
  mimeType: string,
) {
  const config = getCmsS3Config();
  const client = createClient(config.endpoint);
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: storageKey,
      Body: body,
      ContentType: mimeType,
    }),
  );
}

/** @deprecated alias */
export const putObject = putCmsObject;

/** Public URL for an object via the homepage media proxy. */
export function cmsMediaPublicUrl(storageKey: string) {
  const siteUrl = process.env.SITE_URL?.trim().replace(/\/$/, "") ?? "";
  const path = `/api/media/${storageKey
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
  if (!siteUrl) return path;
  return `${siteUrl}${path}`;
}
