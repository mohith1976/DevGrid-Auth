import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import mongoose, { Model } from 'mongoose';

const PROJECT_SCHEMA = new mongoose.Schema({
  userId: { type: String, required: true },
  repoUrl: String,
  name: String,
  description: String,
  readmeUrl: String,
  collaborators: [{ github: String, userId: String, confirmed: Boolean }],
  languages: { type: mongoose.Schema.Types.Mixed },
  verified: { type: Boolean, default: false },
  verifiedAt: Date,
  pointsAwarded: { type: Number, default: 0 },
  contributorsCount: { type: Number, default: 0 },
  commitsCount: { type: Number, default: 0 },
  pullRequestsCount: { type: Number, default: 0 },
}, { timestamps: true });

const PROFILE_SCHEMA = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  points: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  skills: { type: mongoose.Schema.Types.Mixed, default: {} },
  contributionCount: { type: Number, default: 0 },
  totalCommits: { type: Number, default: 0 },
  totalPullRequests: { type: Number, default: 0 },
}, { timestamps: true });

const CERT_SCHEMA = new mongoose.Schema({
  userId: { type: String, required: true },
  title: String,
  issuer: String,
  year: Number,
  meta: mongoose.Schema.Types.Mixed,
}, { timestamps: true });

const ACHV_SCHEMA = new mongoose.Schema({
  userId: { type: String, required: true },
  name: String,
  description: String,
  awardedAt: Date,
}, { timestamps: true });

const PROPOSAL_SCHEMA = new mongoose.Schema({
  ownerId: { type: String, required: true },
  title: { type: String, required: true },
    repoUrl: { type: String, required: true },
  description: String,
  teamSize: { type: Number, default: 3 },
  requirements: {
    minRepoCount: { type: Number, default: 0 },
    languages: [{ type: String }],
    minCommits: { type: Number, default: 0 },
    minLevel: { type: Number, default: 0 },
  },
  applicants: [{ userId: String, message: String, status: { type: String, default: 'pending' }, createdAt: Date }],
  members: [{ userId: String, joinedAt: Date }],
  status: { type: String, default: 'open' }, // open, in-progress, completed, cancelled
  rewardPoints: { type: Number, default: 0 },
  tags: [{ type: String }],
}, { timestamps: true });

@Injectable()
export class MongoService implements OnModuleInit, OnModuleDestroy {
  private projectModel: Model<any> | null = null;
  private profileModel: Model<any> | null = null;
  private certModel: Model<any> | null = null;
  private achvModel: Model<any> | null = null;
  private proposalModel: Model<any> | null = null;

  async onModuleInit() {
    // support either MONGO_URI or legacy MONGODB_ATLAS env var
    const uri = process.env.MONGO_URI || process.env.MONGODB_ATLAS;
    if (!uri) throw new Error('MONGO_URI or MONGODB_ATLAS not set');
    const dbName = process.env.MONGO_DB || process.env.MONGODB_DB || 'DevGrid';
    await mongoose.connect(uri, { dbName });
    this.projectModel = mongoose.models.Project || mongoose.model('Project', PROJECT_SCHEMA);
    this.profileModel = mongoose.models.Profile || mongoose.model('Profile', PROFILE_SCHEMA);
    this.certModel = mongoose.models.Certification || mongoose.model('Certification', CERT_SCHEMA);
    this.achvModel = mongoose.models.Achievement || mongoose.model('Achievement', ACHV_SCHEMA);
    this.proposalModel = mongoose.models.Proposal || mongoose.model('Proposal', PROPOSAL_SCHEMA);
    console.log('Mongo connected');
  }

  async onModuleDestroy() {
    await mongoose.disconnect();
  }

  getProjectModel() { return this.projectModel!; }
  getProfileModel() { return this.profileModel!; }
  getCertModel() { return this.certModel!; }
  getAchvModel() { return this.achvModel!; }
  getProposalModel() { return this.proposalModel!; }
}
