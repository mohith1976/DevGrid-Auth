import { Controller, Get, Post, Req, Body, BadRequestException, Delete, Param, Patch } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { AchievementsService } from './achievements.service';

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

@Controller('api/achievements')
export class AchievementsController {
  constructor(private svc: AchievementsService) {}

  @Get()
  async list(@Req() req:any) {
    const userId = getUserIdFromReq(req);
    if (!userId) throw new BadRequestException('Unauthorized');
    return { achievements: await this.svc.listForUser(userId) };
  }

  @Post()
  async create(@Req() req:any, @Body() body:any) {
    const userId = getUserIdFromReq(req);
    if (!userId) throw new BadRequestException('Unauthorized');
    if (!body?.title) throw new BadRequestException('Missing title');
    if (!body?.description && !body?.story) throw new BadRequestException('Missing description');
    // normalize body to expected shape
    const payload = { title: body.title, description: body.description || body.story || '', media: body.media || [] };
    const doc = await this.svc.create(userId, payload);
    return { success: true, achievement: doc };
  }

  @Delete(':id')
  async del(@Req() req:any, @Param('id') id: string) {
    const userId = getUserIdFromReq(req);
    if (!userId) throw new BadRequestException('Unauthorized');
    const ok = await this.svc.remove(userId, id);
    return { success: ok };
  }

  @Patch(':id')
  async update(@Req() req:any, @Param('id') id: string, @Body() body:any) {
    const userId = getUserIdFromReq(req);
    if (!userId) throw new BadRequestException('Unauthorized');
    const doc = await this.svc.update(userId, id, body);
    if (!doc) throw new BadRequestException('Not found or unauthorized');
    return { success: true, achievement: doc };
  }

  // Note: file uploads are handled via presigned S3 URLs. Use the POST /api/uploads/presign endpoint to obtain
  // a presigned PUT URL from the server, upload directly to S3 from the client, then call POST /api/achievements
  // with the `media` array containing the S3 URL(s).
}
