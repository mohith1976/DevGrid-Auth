import { Controller, Get, Post, Req, UploadedFile, UseInterceptors, Body, BadRequestException, Delete, Param, Patch } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
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

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const dest = join(process.cwd(), 'backend', 'uploads', 'achievements');
        if (!existsSync(dest)) mkdirSync(dest, { recursive: true });
        cb(null, dest);
      },
      filename: (req, file, cb) => {
        const name = Date.now() + '-' + (file.originalname || 'upload');
        cb(null, name);
      }
    }),
    limits: { fileSize: 10 * 1024 * 1024 }
  }))
  async upload(@Req() req:any, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    // return absolute public url so frontend can load media directly
    const host = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`;
    const url = `${host}/uploads/achievements/${file.filename}`;
    return { success: true, url };
  }
}
