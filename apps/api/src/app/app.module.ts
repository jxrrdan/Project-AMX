import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from '../common/prisma/prisma.module';
import { CommonModule } from '../common/common.module';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AuthModule } from '../modules/auth/auth.module';
import { UsersModule } from '../modules/users/users.module';
import { RolesModule } from '../modules/roles/roles.module';
import { DealersModule } from '../modules/dealers/dealers.module';
import { AuditModule } from '../modules/audit/audit.module';
import { NotificationsModule } from '../modules/notifications/notifications.module';
import { WorkshopModule } from '../modules/workshop/workshop.module';
import { VehiclesModule } from '../modules/vehicles/vehicles.module';
import { PartsModule } from '../modules/parts/parts.module';
import { UsedCarsModule } from '../modules/used-cars/used-cars.module';
import { WarrantyModule } from '../modules/warranty/warranty.module';
import { CrmModule } from '../modules/crm/crm.module';
import { VhcModule } from '../modules/vhc/vhc.module';
import { ListingsModule } from '../modules/listings/listings.module';
import { CourtesyModule } from '../modules/courtesy/courtesy.module';
import { FiModule } from '../modules/fi/fi.module';
import { AccountingModule } from '../modules/accounting/accounting.module';
import { DashboardModule } from '../modules/dashboard/dashboard.module';
import { AiInsightsModule } from '../modules/ai-insights/ai-insights.module';
import { IntegrationsModule } from '../modules/integrations/integrations.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CommonModule,
    AuthModule,
    UsersModule,
    RolesModule,
    DealersModule,
    AuditModule,
    NotificationsModule,
    WorkshopModule,
    VehiclesModule,
    PartsModule,
    UsedCarsModule,
    WarrantyModule,
    CrmModule,
    VhcModule,
    ListingsModule,
    CourtesyModule,
    FiModule,
    AccountingModule,
    DashboardModule,
    AiInsightsModule,
    IntegrationsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
