import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ModuleKey, PermissionAction, UsedVehicleStatus } from '@project-amx/shared';
import type { AuthUser } from '@project-amx/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DvlaService } from '../../common/dvla/dvla.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import {
  AddPhotosDto,
  CreateAppraisalDto,
  CreateDealSheetDto,
  CreateUsedVehicleDto,
  SetAskingPriceDto,
  UpdateUsedVehicleStatusDto,
} from './dto/used-car.dto';
import { UsedCarsService } from './used-cars.service';

@Controller('used-vehicles')
export class UsedCarsController {
  constructor(
    private readonly usedCarsService: UsedCarsService,
    private readonly dvlaService: DvlaService,
  ) {}

  @Get()
  @RequirePermissions({ module: ModuleKey.USED_CARS, action: PermissionAction.VIEW })
  findAll(@CurrentUser() user: AuthUser, @Query('status') status?: UsedVehicleStatus) {
    return this.usedCarsService.findAll(user.dealerId, status);
  }

  @Get('reports/days-in-stock-alerts')
  @RequirePermissions({ module: ModuleKey.USED_CARS, action: PermissionAction.VIEW })
  daysInStockAlerts(@CurrentUser() user: AuthUser) {
    return this.usedCarsService.daysInStockAlerts(user.dealerId);
  }

  @Get('reports/stock-ageing')
  @RequirePermissions({ module: ModuleKey.USED_CARS, action: PermissionAction.VIEW })
  stockAgeing(@CurrentUser() user: AuthUser) {
    return this.usedCarsService.stockAgeingReport(user.dealerId);
  }

  /** Module 4.1 "DVLA API integration — automatic spec lookup by registration number". */
  @Get('dvla-lookup/:reg')
  @RequirePermissions({ module: ModuleKey.USED_CARS, action: PermissionAction.VIEW })
  dvlaLookup(@Param('reg') reg: string) {
    return this.dvlaService.lookup(reg);
  }

  @Get(':id')
  @RequirePermissions({ module: ModuleKey.USED_CARS, action: PermissionAction.VIEW })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.usedCarsService.findOne(user.dealerId, id);
  }

  @Post()
  @RequirePermissions({ module: ModuleKey.USED_CARS, action: PermissionAction.CREATE })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateUsedVehicleDto) {
    return this.usedCarsService.create(user.dealerId, dto);
  }

  @Patch(':id/status')
  @RequirePermissions({ module: ModuleKey.USED_CARS, action: PermissionAction.EDIT })
  updateStatus(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateUsedVehicleStatusDto) {
    return this.usedCarsService.updateStatus(user.dealerId, id, dto);
  }

  @Post(':id/photos')
  @RequirePermissions({ module: ModuleKey.USED_CARS, action: PermissionAction.EDIT })
  addPhotos(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AddPhotosDto) {
    return this.usedCarsService.addPhotos(user.dealerId, id, dto);
  }

  @Patch(':id/asking-price')
  @RequirePermissions({ module: ModuleKey.USED_CARS, action: PermissionAction.EDIT })
  setAskingPrice(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SetAskingPriceDto) {
    return this.usedCarsService.setAskingPrice(user.dealerId, id, dto);
  }

  @Post(':id/appraisal')
  @RequirePermissions({ module: ModuleKey.USED_CARS, action: PermissionAction.CREATE })
  createAppraisal(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreateAppraisalDto) {
    return this.usedCarsService.createAppraisal(user.dealerId, id, dto);
  }

  @Post(':id/deal-sheet')
  @RequirePermissions({ module: ModuleKey.USED_CARS, action: PermissionAction.CREATE })
  createDealSheet(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreateDealSheetDto) {
    return this.usedCarsService.createDealSheet(user.dealerId, id, dto);
  }
}
