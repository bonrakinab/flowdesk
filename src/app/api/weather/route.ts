import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const WMO: Record<number, { label: string; icon: string }> = {
  0: { label: "Clear sky", icon: "sun" },
  1: { label: "Mainly clear", icon: "sun" },
  2: { label: "Partly cloudy", icon: "cloud-sun" },
  3: { label: "Overcast", icon: "cloud" },
  45: { label: "Fog", icon: "cloud-fog" },
  48: { label: "Rime fog", icon: "cloud-fog" },
  51: { label: "Light drizzle", icon: "cloud-drizzle" },
  53: { label: "Drizzle", icon: "cloud-drizzle" },
  55: { label: "Heavy drizzle", icon: "cloud-drizzle" },
  61: { label: "Light rain", icon: "cloud-rain" },
  63: { label: "Rain", icon: "cloud-rain" },
  65: { label: "Heavy rain", icon: "cloud-rain" },
  71: { label: "Light snow", icon: "snow" },
  73: { label: "Snow", icon: "snow" },
  75: { label: "Heavy snow", icon: "snow" },
  77: { label: "Snow grains", icon: "snow" },
  80: { label: "Rain showers", icon: "cloud-rain" },
  81: { label: "Rain showers", icon: "cloud-rain" },
  82: { label: "Violent showers", icon: "cloud-rain" },
  85: { label: "Snow showers", icon: "snow" },
  86: { label: "Snow showers", icon: "snow" },
  95: { label: "Thunderstorm", icon: "storm" },
  96: { label: "Thunderstorm", icon: "storm" },
  99: { label: "Severe storm", icon: "storm" },
};

async function fetchWithTimeout(
  url: string,
  ms: number,
  init?: RequestInit
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json(
      { error: "lat and lon are required" },
      { status: 400 }
    );
  }

  try {
    const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
    weatherUrl.searchParams.set("latitude", String(lat));
    weatherUrl.searchParams.set("longitude", String(lon));
    weatherUrl.searchParams.set(
      "current",
      "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day"
    );
    weatherUrl.searchParams.set("daily", "temperature_2m_max,temperature_2m_min");
    weatherUrl.searchParams.set("timezone", "auto");
    weatherUrl.searchParams.set("forecast_days", "1");

    const geoUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;

    // Weather is required; reverse-geocode is best-effort with a short timeout
    // so a slow geo provider never stalls the widget.
    const weatherPromise = fetchWithTimeout(weatherUrl.toString(), 7_000, {
      next: { revalidate: 600 },
    });
    const geoPromise = fetchWithTimeout(geoUrl, 2_500, {
      next: { revalidate: 86_400 },
    })
      .then(async (r) => (r.ok ? r.json() : null))
      .catch(() => null);

    const weatherRes = await weatherPromise;
    if (!weatherRes.ok) {
      return NextResponse.json(
        { error: "Weather provider unavailable" },
        { status: 502 }
      );
    }

    const weather = await weatherRes.json();
    const geo = await geoPromise;
    const code = Number(weather.current?.weather_code ?? 0);
    const meta = WMO[code] || { label: "Unknown", icon: "cloud" };

    return NextResponse.json(
      {
        temperature: weather.current?.temperature_2m,
        feelsLike: weather.current?.apparent_temperature,
        humidity: weather.current?.relative_humidity_2m,
        wind: weather.current?.wind_speed_10m,
        isDay: Boolean(weather.current?.is_day),
        code,
        label: meta.label,
        icon: meta.icon,
        high: weather.daily?.temperature_2m_max?.[0],
        low: weather.daily?.temperature_2m_min?.[0],
        units: weather.current_units,
        location:
          geo?.city ||
          geo?.locality ||
          geo?.principalSubdivision ||
          geo?.countryName ||
          "Near you",
        updatedAt: weather.current?.time,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
        },
      }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Weather fetch failed" }, { status: 500 });
  }
}
