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
    source is 'api' on success, 'fallback' if anything goes wrong.

    Note: OpenWeatherMap's free /weather endpoint only reports a 'rain' key
    while it is actively raining at the moment of the request - the vast
    majority of the time this key is simply absent, which means "not
    raining right now", not "this location/season gets no rainfall". The
    crop model was trained on expected/seasonal rainfall (mm), so treating
    an absent 'rain' key as 0.0 misrepresents the input and skews
    predictions toward very-low-rainfall crops regardless of N/P/K/pH. We
    instead fall back to the same seasonal average used elsewhere, and only
    use the API's reported amount when it actually reports active rain.
    """
    api_key = current_app.config.get("OPENWEATHER_API_KEY")
    base_url = current_app.config.get("OPENWEATHER_BASE_URL")

    if not api_key or api_key == "your_openweathermap_api_key_here":
        logger.warning("OpenWeather API key not configured; using fallback weather values.")
        return {**FALLBACK_WEATHER, "source": "fallback"}

    try:
        response = requests.get(
            base_url,
            params={"q": city, "appid": api_key, "units": "metric"},
            timeout=5,
        )
        response.raise_for_status()
        data = response.json()

        temperature = data.get("main", {}).get("temp")
        humidity = data.get("main", {}).get("humidity")

        rain_block = data.get("rain")
        if rain_block:
            rainfall = rain_block.get("1h", rain_block.get("3h"))
        else:
            rainfall = None
        if rainfall is None:
            rainfall = FALLBACK_WEATHER["rainfall"]

        if temperature is None or humidity is None:
            raise ValueError("Incomplete weather data from API")

        return {
            "temperature": round(float(temperature), 2),
            "humidity": round(float(humidity), 2),
            "rainfall": round(float(rainfall), 2),
            "source": "api",
        }

    except (requests.RequestException, ValueError, KeyError) as exc:
        logger.warning(f"Weather fetch failed for city='{city}': {exc}. Using fallback values.")
        return {**FALLBACK_WEATHER, "source": "fallback"}
