import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BugReport, BugReportStatus } from './entities/bug-report.entity';
import { FeatureRequest, FeatureRequestStatus } from './entities/feature-request.entity';

@Injectable()
export class FeedbackService {
  constructor(
    @InjectRepository(BugReport)      private readonly bugRepo: Repository<BugReport>,
    @InjectRepository(FeatureRequest) private readonly featureRepo: Repository<FeatureRequest>,
  ) {}

  // ── Bug Reports ────────────────────────────────────────────────

  async createBugReport(userId: string, dto: {
    title: string;
    description?: string;
    attachmentUrls?: string[];
    attachmentKeys?: string[];
  }): Promise<BugReport> {
    const report = this.bugRepo.create({
      userId,
      title: dto.title,
      description: dto.description ?? null,
      attachmentUrls: dto.attachmentUrls?.length ? dto.attachmentUrls : null,
      attachmentKeys: dto.attachmentKeys?.length ? dto.attachmentKeys : null,
      status: 'unread',
    });
    return this.bugRepo.save(report);
  }

  async getMyBugReports(userId: string): Promise<BugReport[]> {
    return this.bugRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  // ── Feature Requests ───────────────────────────────────────────

  async createFeatureRequest(userId: string, dto: {
    title: string;
    description?: string;
  }): Promise<FeatureRequest> {
    const request = this.featureRepo.create({
      userId,
      title: dto.title,
      description: dto.description ?? null,
      status: 'unread',
    });
    return this.featureRepo.save(request);
  }

  async getMyFeatureRequests(userId: string): Promise<FeatureRequest[]> {
    return this.featureRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  // ── Admin ──────────────────────────────────────────────────────

  async getAllBugReports(): Promise<BugReport[]> {
    return this.bugRepo.find({
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async getAllFeatureRequests(): Promise<FeatureRequest[]> {
    return this.featureRepo.find({
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async updateBugReportStatus(id: string, status: BugReportStatus): Promise<BugReport> {
    const report = await this.bugRepo.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Баг-репорт не найден');
    report.status = status;
    return this.bugRepo.save(report);
  }

  async updateFeatureRequestStatus(id: string, status: FeatureRequestStatus): Promise<FeatureRequest> {
    const request = await this.featureRepo.findOne({ where: { id } });
    if (!request) throw new NotFoundException('Заявка не найдена');
    request.status = status;
    return this.featureRepo.save(request);
  }
}
