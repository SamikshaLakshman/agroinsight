"""
AgroInsight - Weather Service
===============================
Fetches live temperature, humidity, and rainfall for a given city from
OpenWeatherMap. Falls back to sensible regional averages if the API call
fails (missing key, network error, city not found) so the recommendation
flow never breaks because of an external dependency.
"""

import logging

import requests
from flask import current_app

logger = logging.getLogger(__name__)
if not logger.handlers:
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
    logger.addHandler(_handler)
    logger.setLevel(logging.WARNING)
    logger.propagate = True

FALLBACK_WEATHER = {
    "temperature": 25.0,
    "humidity": 70.0,
    "rainfall": 100.0,
}


def fetch_weather_by_city(city: str) -> dict:
    api_key = current_app.config.get("OPENWEATHER_API_KEY")
    base_url = current_app.config.get("OPENWEATHER_FORECAST_URL") or (
        "https://api.openweathermap.org/data/2.5/forecast"
    )

    if not api_key or api_key == "your_openweathermap_api_key_here":
        logger.warning("OpenWeather API key not configured; using fallback weather values.")
        return {**FALLBACK_WEATHER, "source": "fallback", "fallback_reason": "api_key_not_configured"}

    try:
        response = requests.get(
            base_url,
            params={"q": city, "appid": api_key, "units": "metric"},
            timeout=8,
        )
        response.raise_for_status()
        data = response.json()

        points = data.get("list") or []
        if not points:
            raise ValueError("Forecast API returned no data points")

        temps, humidities, rain_per_interval = [], [], []
        for point in points:
            main = point.get("main", {})
            temp = main.get("temp")
            humidity = main.get("humidity")
            if temp is not None:
                temps.append(float(temp))
            if humidity is not None:
                humidities.append(float(humidity))
            rain_block = point.get("rain") or {}
            snow_block = point.get("snow") or {}
            interval_precip = float(rain_block.get("3h", 0.0)) + float(snow_block.get("3h", 0.0))
            rain_per_interval.append(interval_precip)

        if not temps or not humidities:
            raise ValueError("Incomplete forecast data from API")

        avg_temp = sum(temps) / len(temps)
        avg_humidity = sum(humidities) / len(humidities)
        avg_rain_per_interval = sum(rain_per_interval) / len(rain_per_interval)
        monthly_rainfall = avg_rain_per_interval * 8 * 30

        return {
            "temperature": round(avg_temp, 2),
            "humidity": round(avg_humidity, 2),
            "rainfall": round(monthly_rainfall, 2),
            "source": "forecast_avg",
            "forecast_points_used": len(points),
        }

    except (requests.RequestException, ValueError, KeyError) as exc:
        logger.warning(f"Weather fetch failed for city='{city}': {exc}. Using fallback values.")
        return {**FALLBACK_WEATHER, "source": "fallback", "fallback_reason": str(exc)}
