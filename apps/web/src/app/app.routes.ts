import { Route } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const appRoutes: Route[] = [
  { path: 'login', loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent) },
  {
    // Public, unauthenticated — this is the "embeddable enquiry form" from Feature Spec §8.1.
    path: 'enquiry/:dealerId',
    loadComponent: () => import('./features/public/enquiry-form.component').then((m) => m.EnquiryFormComponent),
  },
  {
    // Public, unauthenticated — the customer VHC approval report from Feature Spec §9.2-9.3.
    path: 'vhc-report/:id',
    loadComponent: () => import('./features/public/vhc-report.component').then((m) => m.VhcReportComponent),
  },
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
        // Literal segment — must come before 'workshop/job-cards/:id' below.
        path: 'workshop/loading',
        loadComponent: () => import('./features/workshop/workshop-loading.component').then((m) => m.WorkshopLoadingComponent),
      },
      {
        path: 'workshop/job-cards/:id',
        loadComponent: () => import('./features/workshop/job-card-detail.component').then((m) => m.JobCardDetailComponent),
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
        path: 'parts/purchase-orders',
        loadComponent: () => import('./features/parts/purchase-orders.component').then((m) => m.PurchaseOrdersComponent),
      },
      {
        path: 'parts/:id',
        loadComponent: () => import('./features/parts/part-detail.component').then((m) => m.PartDetailComponent),
      },
      {
        path: 'used-cars',
        loadComponent: () => import('./features/used-cars/used-cars-list.component').then((m) => m.UsedCarsListComponent),
      },
      {
        path: 'used-cars/:id',
        loadComponent: () => import('./features/used-cars/used-car-detail.component').then((m) => m.UsedCarDetailComponent),
      },
      {
        path: 'warranty',
        loadComponent: () => import('./features/warranty/warranty-list.component').then((m) => m.WarrantyListComponent),
      },
      {
        path: 'warranty/:id',
        loadComponent: () =>
          import('./features/warranty/warranty-claim-detail.component').then((m) => m.WarrantyClaimDetailComponent),
      },
      {
        path: 'crm',
        loadComponent: () => import('./features/crm/leads-board.component').then((m) => m.LeadsBoardComponent),
      },
      {
        path: 'crm/contacts',
        loadComponent: () => import('./features/crm/contacts-list.component').then((m) => m.ContactsListComponent),
      },
      {
        path: 'crm/contacts/:id',
        loadComponent: () => import('./features/crm/contact-detail.component').then((m) => m.ContactDetailComponent),
      },
      {
        path: 'vhc',
        loadComponent: () => import('./features/vhc/vhc-list.component').then((m) => m.VhcListComponent),
      },
      {
        path: 'vhc/:id',
        loadComponent: () =>
          import('./features/vhc/vhc-inspection-detail.component').then((m) => m.VhcInspectionDetailComponent),
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
      {
        path: 'admin/settings',
        loadComponent: () => import('./features/admin/settings.component').then((m) => m.SettingsComponent),
      },
      {
        path: 'my-profile',
        loadComponent: () => import('./features/profile/my-profile.component').then((m) => m.MyProfileComponent),
      },
      {
        path: 'admin/document-templates/:id',
        loadComponent: () =>
          import('./features/admin/document-template-editor.component').then((m) => m.DocumentTemplateEditorComponent),
      },
      {
        path: 'admin/action-triggers/:id',
        loadComponent: () =>
          import('./features/admin/action-trigger-editor.component').then((m) => m.ActionTriggerEditorComponent),
      },
      {
        path: 'integrations',
        loadComponent: () =>
          import('./features/integrations/integrations-list.component').then((m) => m.IntegrationsListComponent),
      },
      {
        // Literal segment — must come before the ':id' wildcard route below.
        path: 'integrations/screens',
        loadComponent: () =>
          import('./features/integrations/screen-designer.component').then((m) => m.ScreenDesignerComponent),
      },
      {
        path: 'integrations/:id',
        loadComponent: () =>
          import('./features/integrations/connector-detail.component').then((m) => m.ConnectorDetailComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
