import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RiskMapController } from './risk-map.controller';
import { RiskMapService } from './risk-map.service';
import { FireIncident } from '../incidents/fire-incident.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FireIncident])],
  controllers: [RiskMapController],
  providers: [RiskMapService],
  exports: [RiskMapService],
})
export class RiskMapModule {}
