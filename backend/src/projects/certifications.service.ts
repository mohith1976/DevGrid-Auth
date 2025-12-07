import { Injectable, Logger } from '@nestjs/common';
import { MongoService } from '../mongo/mongo.service';

@Injectable()
export class CertificationsService {
  private readonly logger = new Logger(CertificationsService.name);
  constructor(private mongo: MongoService) {}

  async create(userId: string, payload: any) {
    const Cert = this.mongo.getCertModel();
    const doc = await Cert.create({
      userId,
      title: payload.title,
      issuer: payload.issuer || '',
      year: payload.year || null,
      meta: payload.meta || {},
      file: payload.file || null,
      createdAt: new Date(),
    });
    return doc.toObject ? doc.toObject() : doc;
  }

  async listForUser(userId: string) {
    const Cert = this.mongo.getCertModel();
    return Cert.find({ userId }).sort({ createdAt: -1 }).lean();
  }

  async remove(userId: string, id: string) {
    const Cert = this.mongo.getCertModel();
    const res = await Cert.deleteOne({ _id: id, userId });
    return res.deletedCount === 1;
  }
}
