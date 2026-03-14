import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';
import { RepositoryService, Repository, StatsResponse } from '../../core/services/repository.service';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';
import { NumberFormatPipe } from '../../shared/pipes/number-format.pipe';
import { LanguageDotComponent } from '../../shared/components/language-dot.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';

@Component({
  selector: 'app-repository-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatIconModule,
    MatButtonModule,
    RelativeTimePipe,
    NumberFormatPipe,
    LanguageDotComponent,
    SkeletonComponent
  ],
  templateUrl: './repository-list.component.html',
  styleUrls: ['./repository-list.component.css']
})
export class RepositoryListComponent implements OnInit, OnDestroy {
  repositories: Repository[] = [];
  stats: StatsResponse | null = null;
  loading = true;
  loadingMore = false;
  hasMore = true;
  nextCursor: string | null = null;

  searchControl = new FormControl('');
  sortControl = new FormControl('stars_desc');
  languageControl = new FormControl('');

  private destroy$ = new Subject<void>();
  readonly SKELETON_ITEMS = Array(12).fill(0);

  constructor(
    private repositoryService: RepositoryService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadStats();
    this.loadRepositories();

    // Setup debounce for search input
    this.searchControl.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(400),
        distinctUntilChanged()
      )
      .subscribe(() => {
        this.resetPagination();
        this.loadRepositories();
      });

    // Listen to sort/filter changes
    this.sortControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.resetPagination();
      this.loadRepositories();
    });
    
    this.languageControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.resetPagination();
      this.loadRepositories();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadStats(): void {
    this.repositoryService.getStats().subscribe(stats => {
      this.stats = stats;
    });
  }

  loadRepositories(loadMore = false): void {
    const searchTerm = this.searchControl.value?.trim();
    
    if (searchTerm) {
      if (!loadMore) this.loading = true;
      else this.loadingMore = true;

      this.repositoryService.searchRepositories(searchTerm, 50).subscribe({
        next: (repos) => {
          this.repositories = repos;
          this.hasMore = false;
          this.loading = false;
          this.loadingMore = false;
        },
        error: () => {
          this.loading = false;
          this.loadingMore = false;
        }
      });
      return;
    }

    if (!loadMore) {
      this.loading = true;
    } else {
      this.loadingMore = true;
    }

    const params = {
      cursor: loadMore ? this.nextCursor || undefined : undefined,
      perPage: 12,
      sort: this.sortControl.value || 'stars_desc',
      language: this.languageControl.value || undefined
    };

    this.repositoryService.getRepositories(params).subscribe({
      next: (response) => {
        if (loadMore) {
          this.repositories = [...this.repositories, ...response.data];
        } else {
          this.repositories = response.data;
        }
        
        this.hasMore = response.pagination.hasMore;
        this.nextCursor = response.pagination.nextCursor;
        this.loading = false;
        this.loadingMore = false;
      },
      error: () => {
        this.loading = false;
        this.loadingMore = false;
      }
    });
  }

  resetPagination(): void {
    this.nextCursor = null;
    this.hasMore = true;
    this.repositories = [];
    this.loading = true;
  }

  onLoadMore(): void {
    if (!this.loadingMore && this.hasMore) {
      this.loadRepositories(true);
    }
  }

  viewRepository(id: string): void {
    this.router.navigate(['/repo', id]);
  }
}
