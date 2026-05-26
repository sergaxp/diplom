import {
  Controller, Get, Post,
  Body, Request, UseGuards,
} from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('feedback')
@UseGuards(JwtAuthGuard)
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  // ── Bug Reports ────────────────────────────────────────────────

  @Post('bugs')
  createBugReport(
    @Request() req: { user: { id: string } },
    @Body() body: {
      title: string;
      description?: string;
      attachmentUrls?: string[];
      attachmentKeys?: string[];
    },
  ) {
    return this.feedbackService.createBugReport(req.user.id, body);
  }

  @Get('bugs/my')
  getMyBugReports(@Request() req: { user: { id: string } }) {
    return this.feedbackService.getMyBugReports(req.user.id);
  }

  // ── Feature Requests ───────────────────────────────────────────

  @Post('features')
  createFeatureRequest(
    @Request() req: { user: { id: string } },
    @Body() body: { title: string; description?: string },
  ) {
    return this.feedbackService.createFeatureRequest(req.user.id, body);
  }

  @Get('features/my')
  getMyFeatureRequests(@Request() req: { user: { id: string } }) {
    return this.feedbackService.getMyFeatureRequests(req.user.id);
  }
}
