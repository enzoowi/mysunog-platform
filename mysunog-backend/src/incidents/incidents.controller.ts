import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IncidentsService } from './incidents.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../users/user.entity';

@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.FIRE_INVESTIGATOR)
  @Post()
  create(@Body() dto: CreateIncidentDto) {
    return this.incidentsService.create(dto);
  }

  // GET /incidents is guarded — incident data is confidential (bfp_staff+ only)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.BFP_STAFF, UserRole.ADMIN, UserRole.FIRE_INVESTIGATOR)
  @Get()
  findAll(@Query('barangay') barangay?: string) {
    return this.incidentsService.findAll(barangay);
  }

  // Search is also guarded — used in Reports and FireRiskMap
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.BFP_STAFF, UserRole.ADMIN, UserRole.FIRE_INVESTIGATOR)
  @Get('search')
  search(
    @Query('barangay') barangay?: string,
    @Query('cause') cause?: string,
    @Query('propertyType') propertyType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.incidentsService.search({
      barangay,
      cause,
      propertyType,
      startDate,
      endDate,
    });
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.BFP_STAFF, UserRole.ADMIN, UserRole.FIRE_INVESTIGATOR)
  @Get('dashboard-summary')
  getDashboardSummary(@Query('period') period?: string) {
    return this.incidentsService.getDashboardSummary(period);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.BFP_STAFF, UserRole.ADMIN, UserRole.FIRE_INVESTIGATOR)
  @Post('ai-insights')
  getAiInsights(@Body() summaryData: any) {
    return this.incidentsService.generateDashboardInsights(summaryData);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.BFP_STAFF, UserRole.ADMIN, UserRole.FIRE_INVESTIGATOR)
  @Get('response-performance')
  getResponsePerformance() {
    return this.incidentsService.getResponsePerformance();
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('deleted')
  getDeleted() {
    return this.incidentsService.getDeleted();
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post(':id/restore')
  restore(@Param('id') id: string) {
    return this.incidentsService.restore(+id);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id/permanent')
  hardDelete(@Param('id') id: string) {
    return this.incidentsService.hardDelete(+id);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.BFP_STAFF, UserRole.ADMIN, UserRole.FIRE_INVESTIGATOR)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.incidentsService.remove(+id);
  }
}

