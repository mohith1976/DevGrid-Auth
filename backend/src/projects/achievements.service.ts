import { Injectable, Logger } from '@nestjs/common';
import { MongoService } from '../mongo/mongo.service';

@Injectable()
export class AchievementsService {
  private readonly logger = new Logger(AchievementsService.name);
  constructor(private mongo: MongoService) {}

  async create(userId: string, payload: any) {
    const Achv = this.mongo.getAchvModel();
    const doc = await Achv.create({
      userId,
      name: payload.title,
      // use description as the long-form story
      description: payload.description || payload.story || '',
      media: payload.media || [],
      awardedAt: payload.awardedAt ? new Date(payload.awardedAt) : new Date(),
    });
    return doc.toObject ? doc.toObject() : doc;
  }

  async listForUser(userId: string) {
    const Achv = this.mongo.getAchvModel();
    return Achv.find({ userId }).sort({ createdAt: -1 }).lean();
  }

  async getById(id: string) {
    const Achv = this.mongo.getAchvModel();
    return Achv.findById(id).lean();
  }

  async update(userId: string, id: string, payload: any) {
    const Achv = this.mongo.getAchvModel();
    const update: any = {};
    if (payload.title !== undefined) update.name = payload.title;
    if (payload.description !== undefined) update.description = payload.description;
    if (payload.story !== undefined && !update.description) update.description = payload.story;
    if (payload.media !== undefined) update.media = payload.media;
    const doc = await Achv.findOneAndUpdate({ _id: id, userId }, { $set: update }, { new: true }).lean();
    return doc;
  }

  async remove(userId: string, id: string) {
    const Achv = this.mongo.getAchvModel();
    const res = await Achv.deleteOne({ _id: id, userId });
    return res.deletedCount === 1;
  }
}
