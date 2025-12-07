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
  file: String,
  meta: mongoose.Schema.Types.Mixed,
}, { timestamps: true });

const ACHV_SCHEMA = new mongoose.Schema({
  userId: { type: String, required: true },
  name: String,
  description: String,
  media: [{ type: String }],
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
    // support both legacy name and new preferred name
    minCommits: { type: Number, default: 0 },
    minContributions: { type: Number, default: 0 },
    minLevel: { type: Number, default: 0 },
  },
  applicants: [{ userId: String, message: String, status: { type: String, default: 'pending' }, createdAt: Date }],
  members: [{ userId: String, joinedAt: Date }],
  status: { type: String, default: 'open' }, // open, in-progress, completed, cancelled
  rewardPoints: { type: Number, default: 0 },
  tags: [{ type: String }],
  teamId: { type: String, default: null },
}, { timestamps: true });

// Prevent creating duplicate proposals with identical title + repoUrl across the system
PROPOSAL_SCHEMA.index({ title: 1, repoUrl: 1 }, { unique: true });

@Injectable()
export class MongoService implements OnModuleInit, OnModuleDestroy {
  private projectModel: Model<any> | null = null;
  private profileModel: Model<any> | null = null;
  private certModel: Model<any> | null = null;
  private achvModel: Model<any> | null = null;
  private proposalModel: Model<any> | null = null;
  private teamModel: Model<any> | null = null;

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
    const TEAM_SCHEMA = new mongoose.Schema({
      proposalId: { type: String, required: true },
      name: { type: String, required: true },
      ownerId: { type: String, required: true },
      members: [{ userId: String, joinedAt: Date, role: { type: String, default: 'member' } }],
      // simple chat messages; in a real app this would be a separate collection or a socket service
      messages: [{ userId: String, message: String, createdAt: Date }],
      meta: { type: mongoose.Schema.Types.Mixed }
    }, { timestamps: true });

    this.proposalModel = mongoose.models.Proposal || mongoose.model('Proposal', PROPOSAL_SCHEMA);
    this.teamModel = mongoose.models.Team || mongoose.model('Team', TEAM_SCHEMA);
    console.log('Mongo connected');
    // Ensure indexes (create unique index on title+repoUrl). If there are existing duplicates
    // this may fail — that's expected and should be handled by an operator.
    try {
      await this.proposalModel.createIndexes();
      console.log('Proposal indexes ensured');
    } catch (e:any) {
      console.warn('Failed to create proposal indexes (may already exist or duplicates present):', e?.message || e);
    }
  }

  async onModuleDestroy() {
    await mongoose.disconnect();
  }

  getProjectModel() { return this.projectModel!; }
  getProfileModel() { return this.profileModel!; }
  getCertModel() { return this.certModel!; }
  getAchvModel() { return this.achvModel!; }
  getProposalModel() { return this.proposalModel!; }
  getTeamModel() { return (this as any).teamModel!; }
}
