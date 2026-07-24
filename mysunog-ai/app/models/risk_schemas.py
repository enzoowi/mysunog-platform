"""
Pydantic schemas for the Fire Risk Prediction & Mapping System.
Defines request/response models for barangay-level risk scoring.
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum


class RiskLevel(str, Enum):
    """Fire risk classification levels."""
    LOW = "Low"
    MODERATE = "Moderate"
    HIGH = "High"
    SEVERE = "Severe"


class WeatherData(BaseModel):
    """Real-time weather data from OpenWeatherMap API."""
    temperature_c: float = Field(description="Current temperature in Celsius")
    feels_like_c: float = Field(description="Feels-like temperature in Celsius")
    humidity_pct: float = Field(description="Relative humidity percentage")
    wind_speed_kph: float = Field(description="Wind speed in km/h")
    heat_index: Optional[float] = Field(None, description="Calculated heat index")
    rainfall_mm: float = Field(0.0, description="Rainfall in last 1h (mm)")
    description: str = Field(description="Weather condition description")
    icon: str = Field(description="OpenWeatherMap icon code")
    is_live: bool = Field(True, description="Whether this is live data or fallback")


class FactorBreakdown(BaseModel):
    """Detailed score breakdown for each risk factor."""
    historical_fire_score: float = Field(
        ge=0, le=100,
        description="Score based on historical fire incident frequency"
    )
    weather_score: float = Field(
        ge=0, le=100,
        description="Score based on current weather conditions"
    )
    population_density_score: float = Field(
        ge=0, le=100,
        description="Score based on population density"
    )
    building_type_score: float = Field(
        ge=0, le=100,
        description="Score based on building materials and types"
    )


class BarangayRiskScore(BaseModel):
    """Risk assessment result for a single barangay."""
    name: str = Field(description="Barangay name")
    risk_score: float = Field(
        ge=0, le=100,
        description="Composite fire risk score (0-100)"
    )
    risk_level: RiskLevel = Field(description="Categorized risk level")
    factor_breakdown: FactorBreakdown = Field(
        description="Individual scores for each risk factor"
    )
    primary_risk_factors: list[str] = Field(
        description="Human-readable list of top risk contributors"
    )
    recommendations: list[str] = Field(
        description="Actionable recommendations for BFP personnel"
    )
    incident_count: int = Field(
        0, description="Number of historical fire incidents in this barangay"
    )


class RiskScoresRequest(BaseModel):
    """Request body from NestJS backend with real incident counts."""
    barangay_incident_counts: dict[str, int] = Field(
        default_factory=dict,
        description="Map of barangay name to fire incident count from DB"
    )


class RiskScoresResponse(BaseModel):
    """Response containing risk scores for all barangays in a municipality."""
    municipality: str = "Malvar"
    province: str = "Batangas"
    timestamp: str = Field(
        default_factory=lambda: datetime.now().isoformat()
    )
    total_barangays: int = 0
    average_risk_score: float = 0.0
    highest_risk_barangay: Optional[str] = None
    barangay_scores: list[BarangayRiskScore] = []
    weather: Optional[WeatherData] = None
