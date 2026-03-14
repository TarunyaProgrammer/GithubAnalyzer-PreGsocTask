import {
  Controller,
  Get,
  Param,
  Query,
  NotFoundException,
  Logger,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { RepositoryService } from './repository.service';
import {
  RepoQueryDto,
  SearchQueryDto,
  RepositoryResponseDto,
  ContributorResponseDto,
  LanguageResponseDto,
  CommitActivityResponseDto,
  PaginatedResponseDto,
  StatsResponseDto,
} from './repository.dto';

@Controller('api/repos')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class RepositoryController {
  private readonly logger = new Logger(RepositoryController.name);

  constructor(private readonly repositoryService: RepositoryService) {}

  /**
   * GET /api/repos — Paginated list with filters and sorting
   */
  @Get()
  async getRepositories(
    @Query() query: RepoQueryDto,
  ): Promise<PaginatedResponseDto<RepositoryResponseDto>> {
    return this.repositoryService.getRepositories(query);
  }

  /**
   * GET /api/repos/stats — Aggregate statistics
   */
  @Get('stats')
  async getStats(): Promise<StatsResponseDto> {
    return this.repositoryService.getStats();
  }

  /**
   * GET /api/repos/search?q= — Full-text search
   */
  @Get('search')
  async searchRepositories(
    @Query() query: SearchQueryDto,
  ): Promise<RepositoryResponseDto[]> {
    return this.repositoryService.searchRepositories(query.q, query.limit);
  }

  /**
   * GET /api/repos/:id — Single repository
   */
  @Get(':id')
  async getRepository(@Param('id') id: string): Promise<RepositoryResponseDto> {
    const repo = await this.repositoryService.getRepository(id);
    if (!repo) {
      throw new NotFoundException(`Repository with ID ${id} not found`);
    }
    return repo;
  }

  /**
   * GET /api/repos/:id/contributors — Contributor list
   */
  @Get(':id/contributors')
  async getContributors(@Param('id') id: string): Promise<ContributorResponseDto[]> {
    return this.repositoryService.getContributors(id);
  }

  /**
   * GET /api/repos/:id/languages — Language breakdown
   */
  @Get(':id/languages')
  async getLanguages(@Param('id') id: string): Promise<LanguageResponseDto[]> {
    return this.repositoryService.getLanguages(id);
  }

  /**
   * GET /api/repos/:id/activity — 52-week commit activity
   */
  @Get(':id/activity')
  async getActivity(@Param('id') id: string): Promise<CommitActivityResponseDto[]> {
    return this.repositoryService.getActivity(id);
  }
}
