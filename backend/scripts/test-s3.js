#!/usr/bin/env node
/*
 Simple test script to validate S3 presign + upload using the same env values
 Usage: node scripts/test-s3.js
 It loads backend/.env if present and prints detailed diagnostics.
*/
const path = require('path');
const fs = require('fs');
(async function(){
  try {
    // load env from backend/.env if present
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
      require('dotenv').config({ path: envPath });
      console.log('Loaded env from', envPath);
    } else {
      console.log('No backend .env found at', envPath, '— using process.env');
    }

    const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
    const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
    const axios = require('axios');

    const bucket = process.env.AWS_BUCKET;
    const region = process.env.AWS_REGION || 'us-east-1';
    const accessKey = process.env.AWS_ACCESS_KEY;
    const secretKey = process.env.AWS_SECRET_KEY;

    if (!bucket || !accessKey || !secretKey) {
      console.error('Missing AWS env variables. Check AWS_BUCKET, AWS_REGION, AWS_ACCESS_KEY, AWS_SECRET_KEY');
      process.exit(2);
    }

    console.log('Bucket:', bucket, 'Region:', region);

    const s3 = new S3Client({ region, credentials: { accessKeyId: accessKey, secretAccessKey: secretKey } });

    const key = `test-presign/${Date.now()}-test.txt`;
    const contentType = 'text/plain';
    const cmd = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
    console.log('Generating presigned PUT URL for key:', key);
    const url = await getSignedUrl(s3, cmd, { expiresIn: 900 });
    console.log('Presigned URL generated (truncated):', url && url.slice(0,200) + (url.length>200? '...':''));

    const publicUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
    console.log('Public URL (expected):', publicUrl);

    // Perform PUT using axios
    const data = 'Hello from DevGrid presign test at ' + new Date().toISOString();
    console.log('Uploading test content using PUT...');
    try {
      const resp = await axios.put(url, data, { headers: { 'Content-Type': contentType }, maxBodyLength: Infinity, validateStatus: ()=>true });
      console.log('PUT response status:', resp.status);
      if (resp.status >= 400) {
        console.error('PUT response headers:', resp.headers);
        console.error('PUT response body:', resp.data);
        console.error('Upload failed — inspect ACL/CORS or credentials.');
      } else {
        console.log('Upload looks successful. Trying HEAD to confirm object exists...');
        try {
          // Try HeadObject (requires permission) — if fails, we'll still attempt public GET
          const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
          console.log('HeadObject success — object metadata:', { ContentLength: head.ContentLength, ContentType: head.ContentType });
        } catch (hErr) {
          console.warn('HeadObject failed (may be permissions):', (hErr && hErr.code) || hErr.message || hErr);
          console.log('Attempting public GET of the object URL (this will fail if bucket/object not public)...');
          try {
            const g = await axios.get(publicUrl, { validateStatus: ()=>true, responseType: 'arraybuffer' });
            console.log('GET status:', g.status);
            if (g.status === 200) console.log('Public GET succeeded — object accessible.');
            else console.log('Public GET returned', g.status, '- object may exist but not public.');
          } catch (ge){ console.warn('GET error', ge && ge.message); }
        }
      }
    } catch (err) {
      console.error('PUT failed with error:', (err && err.response && err.response.data) || err.message || err);
    }

    console.log('Test script finished.');
    process.exit(0);
  } catch (err) {
    console.error('Fatal error in test-s3.js:', err && err.stack || err);
    process.exit(1);
  }
})();
