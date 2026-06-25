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

# Fallback values approximate average growing-season conditions for Indian
# agricultural regions. Used when the live API call cannot complete, and
# also as the rainfall figure when the API has no active-rain reading.
FALLBACK_WEATHER = {
    "temperature": 25.0,
    "humidity": 70.0,
    "rainfall": 100.0,
}


def fetch_weather_by_city(city: str) -> dict:
    """
    Returns a dict: { temperature, humidity, rainfall, source }
    source is 'forecast_avg' on success, 'fallback' if anything goes wrong.

    The crop model was trained on seasonal/expected conditions (mean
    temperature, mean humidity, total rainfall over a growing period), not
    on a single instant-in-time reading. OpenWeatherMap's free /weather
    endpoint returns only "right now," which is noisy and, for rainfall,
    almost always reports nothing (the 'rain' key is only present while it
    is actively raining at the exact moment of the request).

    Instead we call the free 5-day/3-hour forecast endpoint (40 data points
    spanning the next 5 days) and average across all of them:
      - temperature, humidity: mean across all 40 points
      - rainfall: mean per-3h rainfall scaled up to a representative
        monthly total (mean_per_interval * 8 intervals/day * 30 days),
        which lines up with the dataset's rainfall units (mm over a
        season/month) far better than a single "is it raining now" reading.

    True 30-day historical climate normals require a paid OpenWeatherMap
    plan (Statistical Weather Data / History API). This forecast-average
    approach is the closest free-tier equivalent and is far more stable
    than a single snapshot.
    """
    api_key = current_app.config.get("OPENWEATHER_API_KEY")
    base_url = current_app.config.get("OPENWEATHER_FORECAST_URL") or (
        "https://api.openweathermap.org/data/2.5/forecast"
    )

    if not api_key or api_key == "your_openweathermap_api_key_here":
        logger.warning("OpenWeather API key not configured; using fallback weather values.")
        return {**FALLBACK_WEATHER, "source": "fallback"}

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
            # rain/snow are absent on dry intervals, which correctly means 0mm
            # for that 3h slot (unlike the "current weather" endpoint, the
            # forecast list as a whole covers wet AND dry intervals, so
            # averaging across it gives a genuine expected-rainfall signal).
            rain_block = point.get("rain") or {}
            snow_block = point.get("snow") or {}
            interval_precip = float(rain_block.get("3h", 0.0)) + float(snow_block.get("3h", 0.0))
            rain_per_interval.append(interval_precip)

        if not temps or not humidities:
            raise ValueError("Incomplete forecast data from API")

        avg_temp = sum(temps) / len(temps)
        avg_humidity = sum(humidities) / len(humidities)

        # 8 three-hour intervals/day; project the observed 5-day average
        # daily rainfall out to a representative ~30-day (monthly) total,
        # matching the scale of the dataset's rainfall feature.
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
        return {**FALLBACK_WEATHER, "source": "fallback"}
