import type { DayForecast } from "@/lib/weather";
import { cn } from "@/lib/utils";

interface Props {
  day: DayForecast;
}

export function WeatherDayRow({ day }: Props) {
  return (
    <div className="flex items-stretch gap-3 rounded-2xl bg-card overflow-hidden border border-border/40">
      <div
        className={cn(
          "flex items-center justify-center w-12 sm:w-14 text-2xl font-semibold",
          day.weekend ? "" : "text-muted-foreground",
        )}
        style={day.weekend ? { color: "hsl(var(--weather-weekend))" } : undefined}
      >
        {day.letter}
      </div>

      <div className="flex-1 relative h-20 sm:h-24 flex">
        {day.hours.map((h) => (
          <div key={h.hour} className="flex-1 relative flex flex-col">
            <div
              className="w-full"
              style={{
                height: `${h.cloudPct}%`,
                background: "hsl(var(--weather-cloud))",
                opacity: 0.55 + (h.cloudPct / 100) * 0.45,
              }}
            />
            <div className="flex-1" />
            <div
              className="w-full"
              style={{
                height: `${h.clearPct}%`,
                background: h.isDay ? "hsl(var(--weather-sun))" : "hsl(var(--weather-night))",
                boxShadow: h.isDay ? "none" : "inset 0 0 0 1px hsla(0,0%,100%,0.18)",
              }}
            />
            {h.precipPct > 5 && (
              <div
                className="absolute left-0 right-0 top-0 pointer-events-none"
                style={{
                  height: `${Math.max(8, h.precipPct)}%`,
                  background: "hsl(var(--weather-rain))",
                  opacity: 0.35 + (h.precipPct / 100) * 0.65,
                }}
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col items-end justify-center pr-4 sm:pr-5 min-w-[60px]">
        <div className="text-2xl font-semibold leading-none">{day.tMax}°</div>
        <div className="text-xs text-muted-foreground mt-1">{day.tMin}°</div>
      </div>
    </div>
  );
}
