import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { WeatherDayRow } from "@/components/WeatherDayRow";
import { WeatherSettingsDialog } from "@/components/WeatherSettingsDialog";
import { fetchForecast, geocode, type Provider, type GeoResult } from "@/lib/weather";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const LABEL_STEP = 3;

function HourLabels() {
  return (
    <div className="flex items-stretch gap-3 mb-1">
      <div className="w-12 sm:w-14" />
      <div className="flex-1 h-4 flex">
        {HOURS.map((h) => (
          <div key={h} className="flex-1 flex justify-center">
            {h % LABEL_STEP === 0 && (
              <span className="text-[10px] text-muted-foreground leading-none">{h}</span>
            )}
          </div>
        ))}
      </div>
      <div className="min-w-[60px]" />
    </div>
  );
}

interface SavedLocation {
  name: string;
  lat: number;
  lon: number;
}

const DEFAULT_LOC: SavedLocation = {
  name: "Bilbao, Comunidad Autónoma del País Vasco",
  lat: 43.263,
  lon: -2.935,
};

export default function Tiempo() {
  const [provider, setProvider] = useState<Provider>("open-meteo");
  const [location, setLocation] = useState<SavedLocation>(DEFAULT_LOC);
  const [query, setQuery] = useState(DEFAULT_LOC.name);
  const [suggestions, setSuggestions] = useState<GeoResult[]>([]);
  const [showSugg, setShowSugg] = useState(false);

  useEffect(() => {
    const p = localStorage.getItem("weather:provider") as Provider | null;
    const loc = localStorage.getItem("weather:location");
    if (p) setProvider(p);
    if (loc) {
      try {
        const parsed = JSON.parse(loc);
        setLocation(parsed);
        setQuery(parsed.name);
      } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("weather:provider", provider);
  }, [provider]);
  useEffect(() => {
    localStorage.setItem("weather:location", JSON.stringify(location));
  }, [location]);

  const forecastQuery = useQuery({
    queryKey: ["forecast", location.lat, location.lon, provider],
    queryFn: () => fetchForecast(location.lat, location.lon, provider),
    staleTime: 1000 * 60 * 10,
  });

  async function doSearch() {
    const results = await geocode(query);
    if (results.length) {
      const r = results[0];
      const name = [r.name, r.admin, r.country].filter(Boolean).join(", ");
      setLocation({ name, lat: r.lat, lon: r.lon });
      setQuery(name);
      setShowSugg(false);
    }
  }

  async function onQueryChange(v: string) {
    setQuery(v);
    if (v.length >= 3) {
      const r = await geocode(v);
      setSuggestions(r);
      setShowSugg(true);
    } else {
      setShowSugg(false);
    }
  }

  const days = forecastQuery.data;

  return (
    <div className="min-h-screen w-full px-3 sm:px-6 py-4 sm:py-6 max-w-3xl mx-auto">
      <header className="flex items-center gap-2 mb-4">
        <Link to="/">
          <Button variant="ghost" size="icon" aria-label="Volver">
            <ArrowLeft className="size-5" />
          </Button>
        </Link>
        <div className="relative flex-1">
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doSearch()}
            onFocus={() => suggestions.length && setShowSugg(true)}
            onBlur={() => setTimeout(() => setShowSugg(false), 150)}
            className="bg-card border-border/60 rounded-full h-10 px-4 text-sm"
            placeholder="Buscar ciudad…"
          />
          {showSugg && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-popover rounded-xl border border-border/60 overflow-hidden shadow-lg">
              {suggestions.map((s, i) => {
                const name = [s.name, s.admin, s.country].filter(Boolean).join(", ");
                return (
                  <button
                    key={i}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setLocation({ name, lat: s.lat, lon: s.lon });
                      setQuery(name);
                      setShowSugg(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-accent/40"
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <Button
          onClick={doSearch}
          className="rounded-full h-10 px-5 font-medium"
        >
          Ir
        </Button>
        <WeatherSettingsDialog provider={provider} onProviderChange={setProvider} />
      </header>

      {!forecastQuery.isLoading && days && days.length > 0 && <HourLabels />}

      <div className="space-y-2">
        {forecastQuery.isLoading && (
          <div className="text-center text-muted-foreground py-12 text-sm">Cargando…</div>
        )}
        {forecastQuery.isError && (
          <div className="text-center text-destructive py-12 text-sm">
            Error al cargar el pronóstico
          </div>
        )}
        {days?.map((d) => <WeatherDayRow key={d.date} day={d} />)}
      </div>

      <footer className="mt-6 text-center text-[11px] text-muted-foreground">
        Datos: Open-Meteo · Barra superior: nubes/lluvia · Barra inferior: despejado
      </footer>
    </div>
  );
}
