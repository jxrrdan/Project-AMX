import { Route } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const appRoutes: Route[] = [
  { path: 'login', loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent) },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell.component').then((m) => m.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'workshop',
        loadComponent: () => import('./features/workshop/workshop-diary.component').then((m) => m.WorkshopDiaryComponent),
      },
      {
        path: 'vehicles',
        loadComponent: () => import('./features/vehicles/vehicle-pipeline.component').then((m) => m.VehiclePipelineComponent),
      },
      {
        path: 'parts',
        loadComponent: () => import('./features/parts/parts-list.component').then((m) => m.PartsListComponent),
      },
      {
        path: 'used-cars',
        loadComponent: () => import('./features/used-cars/used-cars-list.component').then((m) => m.UsedCarsListComponent),
      },
      {
        path: 'warranty',
        loadComponent: () => import('./features/warranty/warranty-list.component').then((m) => m.WarrantyListComponent),
      },
      {
        path: 'crm',
        loadComponent: () => import('./features/crm/leads-board.component').then((m) => m.LeadsBoardComponent),
      },
      {
        path: 'vhc',
        loadComponent: () => import('./features/vhc/vhc-list.component').then((m) => m.VhcListComponent),
      },
      {
        path: 'listings',
        loadComponent: () => import('./features/listings/listings-list.component').then((m) => m.ListingsListComponent),
      },
      {
        path: 'accounting',
        loadComponent: () => import('./features/accounting/accounting-list.component').then((m) => m.AccountingListComponent),
      },
      {
        path: 'courtesy',
        loadComponent: () => import('./features/courtesy/courtesy-list.component').then((m) => m.CourtesyListComponent),
      },
      {
        path: 'fi',
        loadComponent: () => import('./features/fi/fi-list.component').then((m) => m.FiListComponent),
      },
      {
        path: 'ai',
        loadComponent: () => import('./features/ai/ai-assistant.component').then((m) => m.AiAssistantComponent),
      },
      {
        path: 'admin/users',
        loadComponent: () => import('./features/admin/users-list.component').then((m) => m.UsersListComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
