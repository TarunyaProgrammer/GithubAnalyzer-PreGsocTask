import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/repository-list/repository-list.component').then(m => m.RepositoryListComponent),
    title: 'WebiU - Repositories'
  },
  {
    path: 'repo/:id',
    loadComponent: () => import('./features/repository-detail/repository-detail.component').then(m => m.RepositoryDetailComponent),
    title: 'WebiU - Repository Details'
  },
  {
    path: '**',
    redirectTo: ''
  }
];
