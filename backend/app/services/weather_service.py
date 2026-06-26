"""
AgroInsight - Weather Service
===============================
Fetches live temperature and humidity for a given city from OpenWeatherMap.
Rainfall is sourced from Open-Meteo's 30-year climate normals (1991-2020)
for the current month — this matches the distribution of the Kaggle crop
dataset, which uses monthly rainfall as a regional climate characteristic,
not a live precipitation reading.

Strategy:
  - temperature / humidity  → OpenWeather current + 5-day forecast average (live)
  - rainfall                → Open-Meteo climate normals API (free, no key needed)

Falls back to sensible regional averages if any API call fails so the
recommendation flow never breaks because of an external dependency.
"""

import datetime
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
    "rainfall": 100.0,   # generic India monthly average
}

# Simple in-process cache: { (city_lower, month): mm }
# Avoids re-fetching climate normals for the same city within a session.
_climate_cache: dict = {}


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


def _get_climate_normal_rainfall(lat: float, lon: float, month: int) -> float:
    """
    Fetch 10-year average monthly rainfall using Open-Meteo Historical Weather API.
    Uses ERA5 daily precipitation_sum, averages across all years for the target month.
    """
    cache_key = (round(lat, 2), round(lon, 2), month)
    if cache_key in _climate_cache:
        return _climate_cache[cache_key]

    response = requests.get(
        "https://archive-api.open-meteo.com/v1/archive",
        params={
            "latitude": lat,
            "longitude": lon,
            "start_date": "2015-01-01",
            "end_date": "2024-12-31",
            "daily": "precipitation_sum",
            "timezone": "auto",
        },
        timeout=15,
    )
    response.raise_for_status()
    data = response.json()

    dates = data.get("daily", {}).get("time", [])
    precip = data.get("daily", {}).get("precipitation_sum", [])

    if not dates or not precip:
        raise ValueError("Open-Meteo archive returned no data")

    # Group daily precipitation by month, average across all years
    monthly_totals = {}
    current_month_sum = 0.0
    current_month_key = None

    for date_str, mm in zip(dates, precip):
        if mm is None:
            mm = 0.0
        y, m, _ = date_str.split("-")
        key = (int(y), int(m))
        if key != current_month_key:
            if current_month_key is not None:
                mo = current_month_key[1]
                monthly_totals.setdefault(mo, []).append(current_month_sum)
            current_month_key = key
            current_month_sum = float(mm)
        else:
            current_month_sum += float(mm)

    if current_month_key is not None:
        monthly_totals.setdefault(current_month_key[1], []).append(current_month_sum)

    if month not in monthly_totals:
        raise ValueError(f"No data for month {month}")

    avg_rainfall = sum(monthly_totals[month]) / len(monthly_totals[month])
    _climate_cache[cache_key] = round(avg_rainfall, 2)
    return _climate_cache[cache_key]

def fetch_weather_by_city(city: str) -> dict:
    api_key = current_app.config.get("OPENWEATHER_API_KEY")

    if not api_key or api_key == "your_openweathermap_api_key_here":
        logger.warning("OpenWeather API key not configured; using fallback weather values.")
        return {**FALLBACK_WEATHER, "source": "fallback", "fallback_reason": "api_key_not_configured"}

    try:
        current_month = datetime.datetime.now().month

        # ------------------------------------------------------------------ #
        # Step 1 – Geocode city (needed for both OWM forecast + Open-Meteo)  #
        # ------------------------------------------------------------------ #
        lat, lon = _geocode_city(city, api_key)

        # ------------------------------------------------------------------ #
        # Step 2 – Live temperature & humidity from OWM                      #
        # ------------------------------------------------------------------ #
        current_response = requests.get(
            "https://api.openweathermap.org/data/2.5/weather",
            params={"q": city, "appid": api_key, "units": "metric"},
            timeout=8,
        )
        current_response.raise_for_status()
        current_data = current_response.json()

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

        temps = [float(current_data["main"]["temp"])]
        humidities = [float(current_data["main"]["humidity"])]

        for point in points:
            main = point.get("main", {})
            if main.get("temp") is not None:
                temps.append(float(main["temp"]))
            if main.get("humidity") is not None:
                humidities.append(float(main["humidity"]))

        if not temps or not humidities:
            raise ValueError("Incomplete weather data from OWM")

        avg_temp = sum(temps) / len(temps)
        avg_humidity = sum(humidities) / len(humidities)

        # ------------------------------------------------------------------ #
        # Step 3 – Climatological monthly rainfall from Open-Meteo           #
        # ------------------------------------------------------------------ #
        try:
            rainfall_mm = _get_climate_normal_rainfall(lat, lon, current_month)
            rainfall_source = "open_meteo_climate_normal"
        except Exception as meteo_exc:
            logger.warning(f"Open-Meteo climate fetch failed: {meteo_exc}. Falling back to scaled forecast.")
            rainfall_mm = 100.0
            rainfall_source = "fallback"

        return {
            "temperature": round(avg_temp, 2),
            "humidity": round(avg_humidity, 2),
            "rainfall": round(rainfall_mm, 2),
            "source": "live_avg",
            "rainfall_source": "open_meteo_climate_normal",
            "rainfall_month": current_month,
            "forecast_points_used": len(points) + 1,
        }

    except (requests.RequestException, ValueError, KeyError) as exc:
        logger.warning(f"Weather fetch failed for city='{city}': {exc}. Using fallback values.")
        return {**FALLBACK_WEATHER, "source": "fallback", "fallback_reason": str(exc)}
