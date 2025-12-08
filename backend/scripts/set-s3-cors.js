#!/usr/bin/env node
/**
 * Set S3 bucket CORS using AWS SDK v3.
 * Usage:
 *   node scripts/set-s3-cors.js
 *   node scripts/set-s3-cors.js http://localhost:5173,http://15.207.111.237
 */
const { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } = require('@aws-sdk/client-s3');
const path = require('path');
const fs = require('fs');

(async function(){
  // try to load backend/.env if present
  try {
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
      require('dotenv').config({ path: envPath });
      console.log('Loaded env from', envPath);
    }
  } catch (e) {
    // ignore
  }
  try {
    const bucket = process.env.AWS_BUCKET;
    const region = process.env.AWS_REGION || 'ap-south-1';
    if (!bucket) {
      console.error('AWS_BUCKET not set in env. Ensure backend/.env is present or env vars set.');
      process.exit(2);
    }

    const originsArg = process.argv[2];
    const defaultOrigins = [];
    if (process.env.FRONTEND_URL) defaultOrigins.push(process.env.FRONTEND_URL);
    // add the public IP commonly used in this project as fallback
    defaultOrigins.push('http://15.207.111.237');
    const allowedOrigins = originsArg ? originsArg.split(',') : Array.from(new Set(defaultOrigins.filter(Boolean)));

    console.log('Setting CORS on bucket', bucket, 'region', region);
    console.log('Allowed origins:', allowedOrigins.join(', '));

    const s3 = new S3Client({ region, credentials: { accessKeyId: process.env.AWS_ACCESS_KEY || '', secretAccessKey: process.env.AWS_SECRET_KEY || '' } });

    const corsConfig = {
      CORSRules: [
        {
          AllowedOrigins: allowedOrigins,
          AllowedMethods: ['GET','PUT','POST','HEAD','OPTIONS'],
          AllowedHeaders: ['*'],
          ExposeHeaders: [],
          MaxAgeSeconds: 3000,
        }
      ]
    };

    const cmd = new PutBucketCorsCommand({ Bucket: bucket, CORSConfiguration: corsConfig });
    await s3.send(cmd);
    console.log('CORS applied successfully. Current CORS:');
    try {
      const getCmd = new GetBucketCorsCommand({ Bucket: bucket });
      const current = await s3.send(getCmd);
      console.log(JSON.stringify(current, null, 2));
    } catch (gErr) {
      console.warn('Could not read back CORS (permission?), but put succeeded. Error:', gErr && gErr.message);
    }
    process.exit(0);
  } catch (err) {
    console.error('Failed to set CORS:', err && err.stack || err);
    process.exit(1);
  }
})();
