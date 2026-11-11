import crypto from 'node:crypto';
import { S3Client, PutObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { config } from './config.js';
const s3 = new S3Client({
  endpoint: config.s3.endpoint,
  region: config.s3.region,
  forcePathStyle: true,
  credentials: {
    accessKeyId: config.s3.accessKeyId,
    secretAccessKey: config.s3.secretAccessKey,
  },
});
export const ALLOWED_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};
export async function uploadMedia(buffer, contentType) {
  const ext = ALLOWED_TYPES[contentType];
  if (!ext) {
    const err = new Error(`unsupported content type ${contentType}`);
    err.status = 415;
    throw err;
  }
  const now = new Date();
  const key = `uploads/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}.${ext}`;
  await s3.send(new PutObjectCommand({
    Bucket: config.s3.bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }));
  return { key, url: `${config.mediaPublicBase}/${key}` };
}
export async function storageHealthy() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: config.s3.bucket }));
    return true;
  } catch {
    return false;
  }
}
