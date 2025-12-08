import { Controller, Get, Post, Req, Body, BadRequestException, Delete, Param } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { CertificationsService } from './certifications.service';

function getUserIdFromReq(req:any) {
  const auth = req.headers?.authorization;
  if (!auth) return null;
  const parts = auth.split(' ');
  if (parts.length !== 2) return null;
  try {
    const payload = jwt.verify(parts[1], process.env.JWT_SECRET || 'dev-secret') as any;
    return payload?.sub || null;
  } catch (e) { return null; }
}

@Controller('api/certifications')
export class CertificationsController {
  constructor(private svc: CertificationsService) {}

  @Get()
  async list(@Req() req:any) {
    const userId = getUserIdFromReq(req);
    if (!userId) throw new BadRequestException('Unauthorized');
    return { certifications: await this.svc.listForUser(userId) };
  }

  @Post()
  async create(@Req() req:any, @Body() body:any) {
    const userId = getUserIdFromReq(req);
    if (!userId) throw new BadRequestException('Unauthorized');
    if (!body?.title) throw new BadRequestException('Missing title');
    const payload = { title: body.title, issuer: body.issuer || '', year: body.year || null, file: body.file || null, meta: body.meta || {} };
    const doc = await this.svc.create(userId, payload);
    return { success: true, certification: doc };
  }

  @Delete(':id')
  async del(@Req() req:any, @Param('id') id: string) {
    const userId = getUserIdFromReq(req);
    if (!userId) throw new BadRequestException('Unauthorized');
    const ok = await this.svc.remove(userId, id);
    return { success: ok };
  }

  // Note: file uploads are handled via presigned S3 URLs. Use the POST /api/uploads/presign endpoint to obtain
  // a presigned PUT URL from the server, upload directly to S3 from the client, then call POST /api/certifications
  // with the `file` property containing the S3 URL.
}
