import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeedbackService } from './feedback.service';
import { FeedbackController } from './feedback.controller';
import { BugReport } from './entities/bug-report.entity';
import { FeatureRequest } from './entities/feature-request.entity';

@Module({
  imports: [TypeOrmModule.forFeature([BugReport, FeatureRequest])],
  controllers: [FeedbackController],
  providers: [FeedbackService],
  exports: [FeedbackService],
})
export class FeedbackModule {}
