export type Provider = "open-meteo" | "met-no";

export interface HourPoint {
  hour: number;
  cloudPct: number;
  precipPct: number;
  clearPct: number;
  isDay: boolean;
}

export interface DayForecast {
  date: string;
  letter: string;
  weekend: boolean;
  tMax: number;
  tMin: number;
  hours: HourPoint[];
}

export interface GeoResult {
  name: string;
  admin?: string;
  country?: string;
  lat: number;
  lon: number;
}

const DAY_LETTERS_ES = ["D", "L", "M", "X", "J", "V", "S"];

export async function geocode(query: string): Promise<GeoResult[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    query,
  )}&count=5&language=es&format=json`;
  const r = await fetch(url);
  const j = await r.json();
  return (j.results ?? []).map((x: any) => ({
    name: x.name,
    admin: x.admin1,
    country: x.country,
    lat: x.latitude,
    lon: x.longitude,
  }));
}

export async function fetchForecast(
  lat: number,
  lon: number,
  provider: Provider,
): Promise<DayForecast[]> {
  const model = provider === "met-no" ? "&models=metno_seamless" : "";
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&hourly=cloud_cover,precipitation_probability` +
    `&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset` +
    `&forecast_days=7&timezone=auto${model}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("Forecast failed");
  const j = await r.json();

  const hourlyTimes: string[] = j.hourly.time;
  const cloud: number[] = j.hourly.cloud_cover;
  const precip: number[] = j.hourly.precipitation_probability ?? [];

  const days: DayForecast[] = j.daily.time.map((d: string, i: number) => {
    const dateObj = new Date(d + "T00:00:00");
    const dow = dateObj.getDay();

    const sunrise = new Date(j.daily.sunrise[i]).getTime();
    const sunset = new Date(j.daily.sunset[i]).getTime();

    const hours: HourPoint[] = [];
    for (let h = 0; h < 24; h++) {
      const key = `${d}T${String(h).padStart(2, "0")}:00`;
      const idx = hourlyTimes.indexOf(key);
      const c = idx >= 0 ? cloud[idx] ?? 0 : 0;
      const p = idx >= 0 ? precip[idx] ?? 0 : 0;

      const hourTime = new Date(`${key}:00`).getTime();
      const isDay = hourTime >= sunrise && hourTime < sunset;

      hours.push({
        hour: h,
        cloudPct: c,
        precipPct: p,
        clearPct: Math.max(0, 100 - c),
        isDay,
      });
    }
    return {
      date: d,
      letter: DAY_LETTERS_ES[dow],
      weekend: dow === 0 || dow === 6,
      tMax: Math.round(j.daily.temperature_2m_max[i]),
      tMin: Math.round(j.daily.temperature_2m_min[i]),
      hours,
    };
  });
  return days;
}
