import { useEffect, useState, useCallback, useRef } from "react";

export type WeatherApiData = {
  temperature: number; // °C
  humidity: number; // %
  apparentTemperature: number; // °C
  pressure: number; // hPa
  windSpeed: number; // km/h
  weatherCode: number;
  time: string;
  locationName: string;
};

// Greater Noida, Uttar Pradesh coordinates
const DEFAULT_LAT = 28.4744;
const DEFAULT_LON = 77.5040;
const REFRESH_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export function useWeatherApi(
  lat: number = DEFAULT_LAT,
  lon: number = DEFAULT_LON,
  locationName: string = "Greater Noida, UP"
) {
  const [data, setData] = useState<WeatherApiData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [nextRefreshSec, setNextRefreshSec] = useState<number>(15 * 60);

  const isMounted = useRef(true);

  const fetchWeather = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,surface_pressure,wind_speed_10m&timezone=Asia%2FKolkata`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Weather API returned ${response.status}`);
      }
      
      const json = await response.json();
      if (!isMounted.current) return;

      if (json && json.current) {
        setData({
          temperature: json.current.temperature_2m,
          humidity: json.current.relative_humidity_2m,
          apparentTemperature: json.current.apparent_temperature,
          pressure: json.current.surface_pressure,
          windSpeed: json.current.wind_speed_10m,
          weatherCode: json.current.weather_code,
          time: json.current.time,
          locationName,
        });
        const now = Date.now();
        setLastUpdated(now);
        setNextRefreshSec(15 * 60);
      } else {
        throw new Error("Invalid payload received from Open-Meteo");
      }
    } catch (err: any) {
      if (!isMounted.current) return;
      setError(err?.message || "Failed to fetch weather API");
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [lat, lon, locationName]);

  // Initial fetch & 15-minute interval
  useEffect(() => {
    isMounted.current = true;
    fetchWeather();

    const intervalTimer = setInterval(() => {
      fetchWeather();
    }, REFRESH_INTERVAL_MS);

    // 1-second countdown timer for next refresh display
    const countdownTimer = setInterval(() => {
      setNextRefreshSec((prev) => (prev > 0 ? prev - 1 : 15 * 60));
    }, 1000);

    return () => {
      isMounted.current = false;
      clearInterval(intervalTimer);
      clearInterval(countdownTimer);
    };
  }, [fetchWeather]);

  return {
    data,
    loading,
    error,
    lastUpdated,
    nextRefreshSec,
    refetch: fetchWeather,
  };
}
