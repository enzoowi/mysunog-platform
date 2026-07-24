"""
Fire Risk Prediction Engine for Malvar, Batangas.

Calculates a composite fire risk score (0-100) for each barangay using
a weighted rule-based algorithm considering:
  - Historical fire frequency from REAL database (30%)
  - REAL weather conditions from OpenWeatherMap API (25%)
  - Population density (25%)
  - Building types/materials (20%)

Weather data is fetched LIVE from OpenWeatherMap and cached for 10 minutes.
Incident data is passed from the NestJS backend (real database query).
"""

import time
import math
import httpx
from fastapi import APIRouter
from app.config import settings
from app.models.risk_schemas import (
    BarangayRiskScore,
    FactorBreakdown,
    RiskLevel,
    RiskScoresRequest,
    RiskScoresResponse,
    WeatherData,
)

router = APIRouter()

# ─── WEIGHTS ────────────────────────────────────────────────────────
WEIGHT_HISTORICAL = 0.30
WEIGHT_WEATHER = 0.25
WEIGHT_POPULATION = 0.25
WEIGHT_BUILDING = 0.20

# ─── MALVAR COORDINATES ────────────────────────────────────────────
MALVAR_LAT = 14.0412
MALVAR_LON = 121.1583

# ─── WEATHER CACHE ─────────────────────────────────────────────────
_weather_cache: dict = {}
_weather_cache_time: float = 0.0

# ─── STATIC BARANGAY PROFILES ──────────────────────────────────────
# Population density and building types are static (from PSA census data).
# These change infrequently. Historical fire data now comes from the DB.
BARANGAY_PROFILES = {
    "Bagong Pook": {
        "population_density": "high",
        "building_light_pct": 55,
        "has_industrial": False,
        "has_commercial": True,
    },
    "Bilucao": {
        "population_density": "low",
        "building_light_pct": 40,
        "has_industrial": False,
        "has_commercial": False,
    },
    "Bulihan": {
        "population_density": "medium",
        "building_light_pct": 50,
        "has_industrial": True,
        "has_commercial": True,
    },
    "Luta del Norte": {
        "population_density": "medium",
        "building_light_pct": 45,
        "has_industrial": False,
        "has_commercial": True,
    },
    "Luta del Sur": {
        "population_density": "medium",
        "building_light_pct": 48,
        "has_industrial": False,
        "has_commercial": False,
    },
    "Poblacion": {
        "population_density": "high",
        "building_light_pct": 35,
        "has_industrial": False,
        "has_commercial": True,
    },
    "San Andres": {
        "population_density": "low",
        "building_light_pct": 60,
        "has_industrial": False,
        "has_commercial": False,
    },
    "San Fernando": {
        "population_density": "high",
        "building_light_pct": 52,
        "has_industrial": True,
        "has_commercial": True,
    },
    "San Isidro": {
        "population_density": "low",
        "building_light_pct": 42,
        "has_industrial": False,
        "has_commercial": False,
    },
    "San Juan": {
        "population_density": "high",
        "building_light_pct": 58,
        "has_industrial": False,
        "has_commercial": True,
    },
    "San Pedro I": {
        "population_density": "medium",
        "building_light_pct": 47,
        "has_industrial": False,
        "has_commercial": False,
    },
    "San Pedro II": {
        "population_density": "medium",
        "building_light_pct": 44,
        "has_industrial": False,
        "has_commercial": True,
    },
    "San Pioquinto": {
        "population_density": "medium",
        "building_light_pct": 50,
        "has_industrial": True,
        "has_commercial": False,
    },
    "Santiago": {
        "population_density": "high",
        "building_light_pct": 62,
        "has_industrial": False,
        "has_commercial": True,
    },
}


# ─── WEATHER FETCHING ─────────────────────────────────────────────

async def fetch_live_weather() -> WeatherData:
    """Fetch REAL current weather from OpenWeatherMap API with caching."""
    global _weather_cache, _weather_cache_time

    now = time.time()
    ttl = settings.weather_cache_ttl_seconds

    # Return cached if still fresh
    if _weather_cache and (now - _weather_cache_time) < ttl:
        return WeatherData(**_weather_cache)

    api_key = settings.openweathermap_api_key
    if not api_key:
        print("[WEATHER] No OpenWeatherMap API key configured — using fallback")
        return _fallback_weather()

    try:
        url = (
            f"https://api.openweathermap.org/data/2.5/weather"
            f"?lat={MALVAR_LAT}&lon={MALVAR_LON}"
            f"&appid={api_key}&units=metric"
        )

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()

        temp_c = data["main"]["temp"]
        feels_like = data["main"]["feels_like"]
        humidity = data["main"]["humidity"]
        wind_mps = data["wind"]["speed"]  # m/s
        wind_kph = round(wind_mps * 3.6, 1)  # convert to km/h
        description = data["weather"][0]["description"].title()
        icon = data["weather"][0]["icon"]
        rainfall = data.get("rain", {}).get("1h", 0.0)

        # Calculate heat index (simplified Steadman formula)
        heat_index = _calculate_heat_index(temp_c, humidity)

        weather = WeatherData(
            temperature_c=round(temp_c, 1),
            feels_like_c=round(feels_like, 1),
            humidity_pct=humidity,
            wind_speed_kph=wind_kph,
            heat_index=round(heat_index, 1) if heat_index else None,
            rainfall_mm=round(rainfall, 1),
            description=description,
            icon=icon,
            is_live=True,
        )

        # Update cache
        _weather_cache = weather.model_dump()
        _weather_cache_time = now

        print(f"[WEATHER] Live data: {temp_c}°C, {humidity}% humidity, "
              f"{wind_kph} km/h wind — {description}")

        return weather

    except Exception as e:
        print(f"[WEATHER] API error: {e} — using fallback")
        return _fallback_weather()


def _fallback_weather() -> WeatherData:
    """Fallback weather when API is unavailable."""
    return WeatherData(
        temperature_c=32.0,
        feels_like_c=36.0,
        humidity_pct=65.0,
        wind_speed_kph=12.0,
        heat_index=37.0,
        rainfall_mm=0.0,
        description="Data Unavailable",
        icon="01d",
        is_live=False,
    )


def _calculate_heat_index(temp_c: float, humidity: float) -> float | None:
    """Calculate heat index using the Steadman/Rothfusz formula."""
    if temp_c < 27:
        return None  # Heat index only meaningful above 27°C

    # Convert to Fahrenheit for the standard formula
    t = temp_c * 9 / 5 + 32
    rh = humidity

    # Rothfusz regression equation
    hi = (
        -42.379
        + 2.04901523 * t
        + 10.14333127 * rh
        - 0.22475541 * t * rh
        - 0.00683783 * t * t
        - 0.05481717 * rh * rh
        + 0.00122874 * t * t * rh
        + 0.00085282 * t * rh * rh
        - 0.00000199 * t * t * rh * rh
    )

    # Convert back to Celsius
    return (hi - 32) * 5 / 9


# ─── SCORING FUNCTIONS ─────────────────────────────────────────────

MAX_INCIDENTS = 15  # Normalization cap

def score_historical(incident_count: int) -> float:
    """Score based on number of fire incidents from the REAL database."""
    return min((incident_count / MAX_INCIDENTS) * 100, 100)


def score_weather(weather: WeatherData) -> float:
    """Score based on REAL current weather conditions.
    High temp + low humidity + high wind = dangerous."""
    temp = weather.temperature_c
    humidity = weather.humidity_pct
    wind = weather.wind_speed_kph

    # Temperature contribution (above 30°C is risky, 40°C+ is max)
    temp_score = min(max((temp - 25) / 15 * 100, 0), 100)

    # Humidity contribution (lower humidity = higher risk)
    humidity_score = min(max((100 - humidity) / 80 * 100, 0), 100)

    # Wind contribution (higher wind = faster fire spread)
    wind_score = min(max(wind / 30 * 100, 0), 100)

    # Rainfall reduces fire risk
    rain_reduction = min(weather.rainfall_mm * 5, 30)  # Up to 30% reduction

    raw_score = (temp_score * 0.4) + (humidity_score * 0.35) + (wind_score * 0.25)
    return max(raw_score - rain_reduction, 0)


def score_population_density(density: str) -> float:
    """Score based on population density classification."""
    density_map = {
        "low": 25,
        "medium": 55,
        "high": 85,
    }
    return density_map.get(density, 40)


def score_building_types(
    light_pct: int, has_industrial: bool, has_commercial: bool
) -> float:
    """Score based on building materials and zone types."""
    material_score = min(light_pct * 1.2, 100)
    industrial_bonus = 15 if has_industrial else 0
    commercial_bonus = 8 if has_commercial else 0
    return min(material_score + industrial_bonus + commercial_bonus, 100)


def classify_risk_level(score: float) -> RiskLevel:
    """Classify a numeric score into a risk level."""
    if score >= 76:
        return RiskLevel.SEVERE
    elif score >= 51:
        return RiskLevel.HIGH
    elif score >= 26:
        return RiskLevel.MODERATE
    else:
        return RiskLevel.LOW


def generate_risk_factors(
    hist_score: float,
    weather_score: float,
    pop_score: float,
    building_score: float,
    incident_count: int,
    profile: dict,
    weather: WeatherData,
) -> list[str]:
    """Generate human-readable primary risk factors."""
    factors = []

    scored = [
        (hist_score, "historical"),
        (weather_score, "weather"),
        (pop_score, "population"),
        (building_score, "building"),
    ]
    scored.sort(key=lambda x: x[0], reverse=True)

    for score, factor_type in scored:
        if score < 30:
            continue

        if factor_type == "historical":
            factors.append(
                f"History of {incident_count} fire incident"
                f"{'s' if incident_count != 1 else ''} recorded"
            )
        elif factor_type == "weather":
            factors.append(
                f"Current: {weather.temperature_c}°C, "
                f"{weather.humidity_pct}% humidity, "
                f"{weather.wind_speed_kph} km/h wind"
            )
            if weather.heat_index and weather.heat_index > 40:
                factors.append(
                    f"Dangerous heat index: {weather.heat_index}°C"
                )
        elif factor_type == "population":
            density = profile["population_density"]
            factors.append(f"{density.capitalize()} population density area")
        elif factor_type == "building":
            pct = profile["building_light_pct"]
            factors.append(
                f"{pct}% of structures use light/combustible materials"
            )
            if profile["has_industrial"]:
                factors.append("Contains industrial zone with fire hazards")

    return factors[:4]


def generate_recommendations(risk_level: RiskLevel, profile: dict) -> list[str]:
    """Generate actionable BFP recommendations based on risk level."""
    recs = []

    if risk_level in (RiskLevel.SEVERE, RiskLevel.HIGH):
        recs.append("Schedule immediate fire safety inspection")
        recs.append("Increase patrol frequency in this barangay")
        if profile["building_light_pct"] > 50:
            recs.append(
                "Conduct fire safety awareness campaign on light-material housing"
            )
        if profile["has_industrial"]:
            recs.append("Inspect industrial facilities for compliance")
    elif risk_level == RiskLevel.MODERATE:
        recs.append("Schedule routine fire safety inspection")
        recs.append("Maintain regular patrol schedule")
        if profile["building_light_pct"] > 45:
            recs.append("Distribute fire prevention materials to households")
    else:
        recs.append("Continue standard monitoring")
        recs.append("Include in quarterly inspection rotation")

    recs.append("Verify fire hydrant accessibility and water pressure")
    return recs


# ─── API ENDPOINTS ─────────────────────────────────────────────────

@router.get("/risk-scores", response_model=RiskScoresResponse)
async def get_risk_scores():
    """GET endpoint — calculates risk with zero incident counts (for direct testing)."""
    return await _calculate_risk_scores({})


@router.post("/risk-scores", response_model=RiskScoresResponse)
async def post_risk_scores(request: RiskScoresRequest):
    """
    POST endpoint — receives real incident counts from the NestJS backend.

    The NestJS backend queries the fire_incident table, groups by barangay,
    and passes the counts here for scoring.
    """
    return await _calculate_risk_scores(request.barangay_incident_counts)


async def _calculate_risk_scores(
    incident_counts: dict[str, int],
) -> RiskScoresResponse:
    """Core scoring logic using REAL weather and REAL incident data."""

    # Fetch LIVE weather
    weather = await fetch_live_weather()

    # Pre-calculate weather score (same for whole municipality)
    weather_sc = score_weather(weather)

    barangay_scores: list[BarangayRiskScore] = []

    for name, profile in BARANGAY_PROFILES.items():
        # Real incident count from database (default 0 if not found)
        incident_count = incident_counts.get(name, 0)

        # Calculate individual factor scores
        hist_score = score_historical(incident_count)
        pop_score = score_population_density(profile["population_density"])
        build_score = score_building_types(
            profile["building_light_pct"],
            profile["has_industrial"],
            profile["has_commercial"],
        )

        # Weighted composite score
        composite = (
            hist_score * WEIGHT_HISTORICAL
            + weather_sc * WEIGHT_WEATHER
            + pop_score * WEIGHT_POPULATION
            + build_score * WEIGHT_BUILDING
        )
        composite = round(min(composite, 100), 1)

        risk_level = classify_risk_level(composite)
        primary_factors = generate_risk_factors(
            hist_score, weather_sc, pop_score, build_score,
            incident_count, profile, weather,
        )
        recommendations = generate_recommendations(risk_level, profile)

        barangay_scores.append(
            BarangayRiskScore(
                name=name,
                risk_score=composite,
                risk_level=risk_level,
                factor_breakdown=FactorBreakdown(
                    historical_fire_score=round(hist_score, 1),
                    weather_score=round(weather_sc, 1),
                    population_density_score=round(pop_score, 1),
                    building_type_score=round(build_score, 1),
                ),
                primary_risk_factors=primary_factors,
                recommendations=recommendations,
                incident_count=incident_count,
            )
        )

    # Sort by risk score descending
    barangay_scores.sort(key=lambda x: x.risk_score, reverse=True)

    avg_score = (
        round(
            sum(b.risk_score for b in barangay_scores) / len(barangay_scores), 1
        )
        if barangay_scores
        else 0.0
    )

    highest = barangay_scores[0].name if barangay_scores else None

    return RiskScoresResponse(
        total_barangays=len(barangay_scores),
        average_risk_score=avg_score,
        highest_risk_barangay=highest,
        barangay_scores=barangay_scores,
        weather=weather,
    )
