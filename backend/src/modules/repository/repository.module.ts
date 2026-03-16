import { Module } from '@nestjs/common';
import { SyncModule } from '../sync/sync.module';
import { AnalyzerModule } from '../analyzer/analyzer.module';

import { RepositoryController } from './repository.controller';
import { RepositoryService } from './repository.service';

@Module({
  imports: [SyncModule, AnalyzerModule],
  controllers: [RepositoryController],
  providers: [RepositoryService],
  exports: [RepositoryService],
})
export class RepositoryModule {}
