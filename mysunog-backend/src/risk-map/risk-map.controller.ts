import { Controller, Get } from '@nestjs/common';
import { RiskMapService } from './risk-map.service';

/**
 * Controller for the Fire Risk Prediction & Mapping endpoints.
 * Public endpoint — no auth guard, since fire risk is public safety data.
 */
@Controller('risk-map')
export class RiskMapController {
  constructor(private readonly riskMapService: RiskMapService) {}

  /**
   * GET /risk-map/malvar
   *
   * Returns fire risk scores merged with GeoJSON polygon boundaries
   * for all barangays in Malvar, Batangas.
   * Now uses REAL incident data from the database and REAL weather.
   */
  @Get('malvar')
  async getMalvarRiskMap() {
    return this.riskMapService.getRiskMapData();
  }

  /**
   * GET /risk-map/weather
   *
   * Returns current weather data for the municipality.
   */
  @Get('weather')
  async getWeather() {
    return this.riskMapService.getWeather();
  }
}
