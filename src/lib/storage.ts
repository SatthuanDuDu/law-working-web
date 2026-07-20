import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function getS3Config() {
  return {
    endpoint: requireEnv("S3_ENDPOINT"),
    publicEndpoint: process.env.S3_PUBLIC_ENDPOINT || requireEnv("S3_ENDPOINT"),
    bucket: requireEnv("S3_BUCKET"),
    region: process.env.S3_REGION || "us-east-1",
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

export async function createUploadUrl(storageKey: string, mimeType: string) {
  const config = getS3Config();
  const client = createClient(config.publicEndpoint);
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: storageKey,
    ContentType: mimeType,
  });
  return getSignedUrl(client, command, { expiresIn: 60 * 10 });
}

export async function createDownloadUrl(storageKey: string, fileName: string) {
  const config = getS3Config();
  const client = createClient(config.publicEndpoint);
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
  const client = createClient(config.publicEndpoint);
  const command = new GetObjectCommand({
    Bucket: config.bucket,
    Key: storageKey,
    ResponseContentDisposition: `inline; filename="${encodeURIComponent(fileName)}"`,
    ResponseContentType: mimeType || "application/octet-stream",
  });
  return getSignedUrl(client, command, { expiresIn: 60 * 5 });
}

export async function deleteObject(storageKey: string) {
  const config = getS3Config();
  const client = createClient(config.endpoint);
  await client.send(
    new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: storageKey,
    }),
  );
}
