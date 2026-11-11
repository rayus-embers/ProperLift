function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`[config] missing required environment variable ${name}`);
    process.exit(1);
  }
  return value;
}
function bool(name, fallback) {
  const v = process.env[name];
  if (v === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
}
export const config = {
  port: Number(process.env.PORT || 8080),
  mongoUri: required('MONGO_URI'),
  jwtSecret: required('JWT_SECRET'),
  jwtTtl: process.env.JWT_TTL || '12h',
  s3: {
    endpoint: required('S3_ENDPOINT'),
    region: process.env.S3_REGION || 'garage',
    bucket: required('S3_BUCKET'),
    accessKeyId: required('S3_ACCESS_KEY'),
    secretAccessKey: required('S3_SECRET_KEY'),
  },
  mediaPublicBase: process.env.MEDIA_PUBLIC_BASE || '/media',
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB || 50),
  seed: {
    coachEmail: process.env.SEED_COACH_EMAIL || '',
    coachPassword: process.env.SEED_COACH_PASSWORD || '',
    coachName: process.env.SEED_COACH_NAME || 'Head Coach',
    demoContent: bool('SEED_DEMO_CONTENT', true),
  },
};
if (config.jwtSecret.length < 32) {
  console.error('[config] JWT_SECRET must be at least 32 characters');
  process.exit(1);
}
