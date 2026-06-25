"""
AgroInsight - Weather Service
===============================
Fetches live temperature, humidity, and rainfall for a given city from
OpenWeatherMap. Uses the previous 10 days of historical data (

Falls back to sensible regional averages if the API call fails (missing
key, network error, city not found) so the recommendation flow never
breaks because of an external dependency.
"""

import logging
import time

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


def _geocode_city(city: str, api_key: str) -> tuple:
    """Resolve city name to (lat, lon) using OpenWeather Geocoding API."""
    response = requests.get(
        "https://api.openweathermap.org/geo/1.0/direct",
        params={"q": city, "limit": 1, "appid": api_key},
        timeout=8,
    )
    response.raise_for_status()
    results = response.json()
    if not results:
        raise ValueError(f"City '{city}' not found by geocoding API")
    return results[0]["lat"], results[0]["lon"]


def _fetch_history_day(lat: float, lon: float, dt: int, api_key: str) -> dict:
    """Fetch one day of historical weather via One Call Timemachine (free tier)."""
    response = requests.get(
        "https://api.openweathermap.org/data/3.0/onecall/timemachine",
        params={"lat": lat, "lon": lon, "dt": dt, "appid": api_key, "units": "metric"},
        timeout=8,
    )
    response.raise_for_status()
    return response.json()


def fetch_weather_by_city(city: str) -> dict:
    api_key = current_app.config.get("OPENWEATHER_API_KEY")

    if not api_key or api_key == "your_openweathermap_api_key_here":
        logger.warning("OpenWeather API key not configured; using fallback weather values.")
        return {**FALLBACK_WEATHER, "source": "fallback", "fallback_reason": "api_key_not_configured"}

    try:
        # --- Strategy: use 5-day/3-hour forecast and current weather ---
        # The free tier doesn't include historical data via One Call 3.0,
        # so we combine current conditions with the forecast to get a
        # representative picture. We average all available data points
        # and compute rainfall as the actual total precipitation across
        # the forecast period, scaled to a monthly estimate.

        # Step 1: Get current weather for the city
        current_response = requests.get(
            "https://api.openweathermap.org/data/2.5/weather",
            params={"q": city, "appid": api_key, "units": "metric"},
            timeout=8,
        )
        current_response.raise_for_status()
        current_data = current_response.json()

        # Step 2: Get 5-day forecast
        forecast_response = requests.get(
            "https://api.openweathermap.org/data/2.5/forecast",
            params={"q": city, "appid": api_key, "units": "metric"},
            timeout=8,
        )
        forecast_response.raise_for_status()
        forecast_data = forecast_response.json()

        points = forecast_data.get("list") or []
        if not points:
            raise ValueError("Forecast API returned no data points")

        # Collect temperature and humidity from all forecast points + current
        temps = [float(current_data["main"]["temp"])]
        humidities = [float(current_data["main"]["humidity"])]
        total_precip_mm = 0.0  # actual total precipitation across all intervals

        # Current weather rain (last 1h or 3h)
        current_rain = current_data.get("rain") or {}
        total_precip_mm += float(current_rain.get("1h", current_rain.get("3h", 0.0)))

        for point in points:
            main = point.get("main", {})
            temp = main.get("temp")
            humidity = main.get("humidity")
            if temp is not None:
                temps.append(float(temp))
            if humidity is not None:
                humidities.append(float(humidity))

            # Accumulate actual precipitation per 3h interval
            rain_block = point.get("rain") or {}
            snow_block = point.get("snow") or {}
            total_precip_mm += float(rain_block.get("3h", 0.0))
            total_precip_mm += float(snow_block.get("3h", 0.0))

        if not temps or not humidities:
            raise ValueError("Incomplete weather data from API")

        avg_temp = sum(temps) / len(temps)
        avg_humidity = sum(humidities) / len(humidities)

        # The forecast covers ~5 days. Scale to monthly estimate:
        # total_precip is across 5 days of 3h intervals, so monthly = total * (30/5)
        forecast_days = len(points) * 3 / 24  # actual days covered
        if forecast_days > 0:
            monthly_rainfall = total_precip_mm * (30 / forecast_days)
        else:
            monthly_rainfall = total_precip_mm

        return {
            "temperature": round(avg_temp, 2),
            "humidity": round(avg_humidity, 2),
            "rainfall": round(monthly_rainfall, 2),
            "source": "forecast_avg",
            "forecast_points_used": len(points) + 1,  # +1 for current
        }

    except (requests.RequestException, ValueError, KeyError) as exc:
        logger.warning(f"Weather fetch failed for city='{city}': {exc}. Using fallback values.")
        return {**FALLBACK_WEATHER, "source": "fallback", "fallback_reason": str(exc)}
