import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import {
  MALVAR_BARANGAYS,
  BarangayFeature,
} from './data/malvar-barangays.geojson';
import { FireIncident } from '../incidents/fire-incident.entity';

// ── Weights (mirror Python service) ──────────────────────────────────
const W_HISTORICAL  = 0.30;
const W_WEATHER     = 0.25;
const W_POPULATION  = 0.25;
const W_BUILDING    = 0.20;
const MAX_INCIDENTS = 15;

// ── Malvar coordinates ────────────────────────────────────────────────
const MALVAR_LAT = 14.0412;
const MALVAR_LON = 121.1583;

// ── Static barangay profiles (census-derived) ─────────────────────────
const BARANGAY_PROFILES: Record<string, {
  population_density: 'low' | 'medium' | 'high';
  building_light_pct: number;
  has_industrial: boolean;
  has_commercial: boolean;
}> = {
  'Bagong Pook':   { population_density: 'high',   building_light_pct: 55, has_industrial: false, has_commercial: true  },
  'Bilucao':       { population_density: 'low',    building_light_pct: 40, has_industrial: false, has_commercial: false },
  'Bulihan':       { population_density: 'medium', building_light_pct: 50, has_industrial: true,  has_commercial: true  },
  'Luta del Norte':{ population_density: 'medium', building_light_pct: 45, has_industrial: false, has_commercial: true  },
  'Luta del Sur':  { population_density: 'medium', building_light_pct: 48, has_industrial: false, has_commercial: false },
  'Poblacion':     { population_density: 'high',   building_light_pct: 35, has_industrial: false, has_commercial: true  },
  'San Andres':    { population_density: 'low',    building_light_pct: 60, has_industrial: false, has_commercial: false },
  'San Fernando':  { population_density: 'high',   building_light_pct: 52, has_industrial: true,  has_commercial: true  },
  'San Isidro':    { population_density: 'low',    building_light_pct: 42, has_industrial: false, has_commercial: false },
  'San Juan':      { population_density: 'high',   building_light_pct: 58, has_industrial: false, has_commercial: true  },
  'San Pedro I':   { population_density: 'medium', building_light_pct: 47, has_industrial: false, has_commercial: false },
  'San Pedro II':  { population_density: 'medium', building_light_pct: 44, has_industrial: false, has_commercial: true  },
  'San Pioquinto': { population_density: 'medium', building_light_pct: 50, has_industrial: true,  has_commercial: false },
  'Santiago':      { population_density: 'high',   building_light_pct: 62, has_industrial: false, has_commercial: true  },
};

// ── Weather cache ────────────────────────────────────────────────────
let _weatherCache: any = null;
let _weatherCacheTime = 0;
const WEATHER_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ── Scoring helpers ────────────────────────────────────────────────
function scoreHistorical(count: number): number {
  return Math.min((count / MAX_INCIDENTS) * 100, 100);
}

function scoreWeather(w: any): number {
  const tempScore = Math.min(Math.max(((w.temperature_c - 25) / 15) * 100, 0), 100);
  const humScore  = Math.min(Math.max(((100 - w.humidity_pct) / 80) * 100, 0), 100);
  const windScore = Math.min(Math.max((w.wind_speed_kph / 30) * 100, 0), 100);
  const rainReduction = Math.min(w.rainfall_mm * 5, 30);
  const raw = tempScore * 0.4 + humScore * 0.35 + windScore * 0.25;
  return Math.max(raw - rainReduction, 0);
}

function scorePopulation(density: 'low' | 'medium' | 'high'): number {
  return density === 'high' ? 85 : density === 'medium' ? 55 : 25;
}

function scoreBuilding(lightPct: number, hasIndustrial: boolean, hasCommercial: boolean): number {
  return Math.min(lightPct * 1.2 + (hasIndustrial ? 15 : 0) + (hasCommercial ? 8 : 0), 100);
}

function classifyRisk(score: number): string {
  if (score >= 76) return 'Severe';
  if (score >= 51) return 'High';
  if (score >= 26) return 'Moderate';
  return 'Low';
}

function generateFactors(
  hist: number, weather: number, pop: number, building: number,
  incidentCount: number, profile: typeof BARANGAY_PROFILES[string], w: any,
): string[] {
  const factors: Array<[number, string]> = [
    [hist,    incidentCount > 0 ? `History of ${incidentCount} fire incident${incidentCount !== 1 ? 's' : ''} recorded` : ''],
    [weather, `Current: ${w.temperature_c}°C, ${w.humidity_pct}% humidity, ${w.wind_speed_kph} km/h wind`],
    [pop,     `${profile.population_density.charAt(0).toUpperCase() + profile.population_density.slice(1)} population density area`],
    [building,`${profile.building_light_pct}% of structures use light/combustible materials`],
  ];
  return factors
    .filter(([score, label]) => score >= 30 && label)
    .sort((a, b) => b[0] - a[0])
    .map(([, label]) => label)
    .slice(0, 4);
}

function generateRecommendations(riskLevel: string, profile: typeof BARANGAY_PROFILES[string]): string[] {
  const recs: string[] = [];
  if (riskLevel === 'Severe' || riskLevel === 'High') {
    recs.push('Schedule immediate fire safety inspection');
    recs.push('Increase patrol frequency in this barangay');
    if (profile.building_light_pct > 50) recs.push('Conduct fire safety awareness campaign on light-material housing');
    if (profile.has_industrial) recs.push('Inspect industrial facilities for compliance');
  } else if (riskLevel === 'Moderate') {
    recs.push('Schedule routine fire safety inspection');
    recs.push('Maintain regular patrol schedule');
    if (profile.building_light_pct > 45) recs.push('Distribute fire prevention materials to households');
  } else {
    recs.push('Continue standard monitoring');
    recs.push('Include in quarterly inspection rotation');
  }
  recs.push('Verify fire hydrant accessibility and water pressure');
  return recs;
}

// ── Fallback weather when API unavailable ─────────────────────────
function fallbackWeather() {
  return {
    temperature_c: 32.0,
    feels_like_c: 36.0,
    humidity_pct: 65,
    wind_speed_kph: 12.0,
    heat_index: 37.0,
    rainfall_mm: 0.0,
    description: 'Data Unavailable',
    icon: '01d',
    is_live: false,
  };
}

@Injectable()
export class RiskMapService {
  private readonly logger = new Logger(RiskMapService.name);

  constructor(
    @InjectRepository(FireIncident)
    private readonly incidentRepo: Repository<FireIncident>,
  ) {}

  // ── Fetch real incident counts from DB ─────────────────────────
  private async getIncidentCounts(): Promise<Record<string, number>> {
    try {
      const results = await this.incidentRepo
        .createQueryBuilder('incident')
        .select('incident.barangay', 'barangay')
        .addSelect('COUNT(*)', 'count')
        .groupBy('incident.barangay')
        .getRawMany();

      const counts: Record<string, number> = {};
      for (const row of results) counts[row.barangay] = parseInt(row.count, 10);
      return counts;
    } catch (err: any) {
      this.logger.error(`Failed to query incident counts: ${err.message}`);
      return {};
    }
  }

  // ── Fetch live weather directly from OpenWeatherMap ────────────
  private async fetchWeather(): Promise<any> {
    const now = Date.now();
    if (_weatherCache && now - _weatherCacheTime < WEATHER_TTL_MS) {
      return _weatherCache;
    }

    const apiKey = process.env.OPENWEATHERMAP_API_KEY;
    if (!apiKey) {
      this.logger.warn('OPENWEATHERMAP_API_KEY not set — using fallback weather');
      return fallbackWeather();
    }

    try {
      const url =
        `https://api.openweathermap.org/data/2.5/weather` +
        `?lat=${MALVAR_LAT}&lon=${MALVAR_LON}&appid=${apiKey}&units=metric`;

      const res = await axios.get(url, { timeout: 10_000 });
      const d = res.data;

      const tempC     = d.main.temp;
      const feelsLike = d.main.feels_like;
      const humidity  = d.main.humidity;
      const windKph   = Math.round(d.wind.speed * 3.6 * 10) / 10;
      const rainfall  = d.rain?.['1h'] ?? 0;
      const desc      = d.weather[0].description
        .split(' ')
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

      // Heat index (Steadman / Rothfusz)
      let heatIndex: number | null = null;
      if (tempC >= 27) {
        const t  = tempC * 9 / 5 + 32;
        const rh = humidity;
        const hi =
          -42.379 + 2.04901523 * t + 10.14333127 * rh
          - 0.22475541 * t * rh - 0.00683783 * t * t
          - 0.05481717 * rh * rh + 0.00122874 * t * t * rh
          + 0.00085282 * t * rh * rh - 0.00000199 * t * t * rh * rh;
        heatIndex = Math.round(((hi - 32) * 5 / 9) * 10) / 10;
      }

      const weather = {
        temperature_c: Math.round(tempC * 10) / 10,
        feels_like_c:  Math.round(feelsLike * 10) / 10,
        humidity_pct:  humidity,
        wind_speed_kph: windKph,
        heat_index:    heatIndex,
        rainfall_mm:   Math.round(rainfall * 10) / 10,
        description:   desc,
        icon:          d.weather[0].icon,
        is_live:       true,
      };

      _weatherCache     = weather;
      _weatherCacheTime = now;
      this.logger.log(`Weather: ${tempC}°C, ${humidity}% hum, ${windKph} km/h — ${desc}`);
      return weather;

    } catch (err: any) {
      this.logger.error(`Weather API error: ${err.message} — using fallback`);
      return fallbackWeather();
    }
  }

  // ── Main risk map computation ──────────────────────────────────
  async getRiskMapData() {
    const [incidentCounts, weather] = await Promise.all([
      this.getIncidentCounts(),
      this.fetchWeather(),
    ]);

    const weatherSc = scoreWeather(weather);
    const zones: any[] = [];

    for (const feature of MALVAR_BARANGAYS.features as BarangayFeature[]) {
      const name    = feature.properties.name;
      const profile = BARANGAY_PROFILES[name];

      if (!profile) {
        // Barangay not in profiles — use minimal defaults
        zones.push({
          name,
          center:   feature.properties.center,
          geometry: feature.geometry,
          risk_score: 0,
          risk_level: 'Low',
          factor_breakdown: { historical_fire_score: 0, weather_score: 0, population_density_score: 0, building_type_score: 0 },
          primary_risk_factors: [],
          recommendations: ['No profile data available'],
          incident_count: incidentCounts[name] ?? 0,
        });
        continue;
      }

      const incidentCount = incidentCounts[name] ?? 0;
      const hist    = scoreHistorical(incidentCount);
      const pop     = scorePopulation(profile.population_density);
      const building = scoreBuilding(profile.building_light_pct, profile.has_industrial, profile.has_commercial);

      const composite = Math.min(
        Math.round((hist * W_HISTORICAL + weatherSc * W_WEATHER + pop * W_POPULATION + building * W_BUILDING) * 10) / 10,
        100,
      );

      const riskLevel = classifyRisk(composite);

      zones.push({
        name,
        center:   feature.properties.center,
        geometry: feature.geometry,
        risk_score:  composite,
        risk_level:  riskLevel,
        factor_breakdown: {
          historical_fire_score:    Math.round(hist * 10) / 10,
          weather_score:            Math.round(weatherSc * 10) / 10,
          population_density_score: Math.round(pop * 10) / 10,
          building_type_score:      Math.round(building * 10) / 10,
        },
        primary_risk_factors: generateFactors(hist, weatherSc, pop, building, incidentCount, profile, weather),
        recommendations: generateRecommendations(riskLevel, profile),
        incident_count: incidentCount,
      });
    }

    // Sort by risk score desc
    zones.sort((a, b) => b.risk_score - a.risk_score);

    const avg = zones.length
      ? Math.round((zones.reduce((s, z) => s + z.risk_score, 0) / zones.length) * 10) / 10
      : 0;

    return {
      municipality:          'Malvar',
      province:              'Batangas',
      timestamp:             new Date().toISOString(),
      total_barangays:       zones.length,
      average_risk_score:    avg,
      highest_risk_barangay: zones[0]?.name ?? null,
      zones,
      weather,
      incident_counts: incidentCounts,
    };
  }

  /** Proxy — returns just the weather data (used by weather widget) */
  async getWeather() {
    return this.fetchWeather();
  }
}
