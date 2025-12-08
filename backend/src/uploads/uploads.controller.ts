import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Controller('api/uploads')
export class UploadsController {
  @Post('/presign')
  async presign(@Body() body: { filename: string; contentType?: string; folder?: string }) {
    const { filename, contentType = 'application/octet-stream', folder = 'uploads' } = body || {};
    if (!filename) throw new BadRequestException('filename required');
    const bucket = process.env.AWS_BUCKET;
    const region = process.env.AWS_REGION || 'us-east-1';
    if (!bucket) throw new BadRequestException('S3 bucket not configured');

    const keySafe = filename.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
    const key = `${folder}/${Date.now()}-${keySafe}`;

    const s3 = new S3Client({ region, credentials: { accessKeyId: process.env.AWS_ACCESS_KEY || '', secretAccessKey: process.env.AWS_SECRET_KEY || '' } });
    const cmd = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType, ACL: 'public-read' });
    const url = await getSignedUrl(s3, cmd, { expiresIn: 900 });
    const publicUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
    return { url, key, publicUrl, expiresIn: 900 };
  }
}
