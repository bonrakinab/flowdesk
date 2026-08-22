/** Activity tips from current weather conditions. */

export type WeatherAdviceInput = {
  icon: string;
  label: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  wind: number;
  isDay: boolean;
};

export type WeatherAdvice = {
  doList: string[];
  dontList: string[];
  summary: string;
};

export function getWeatherAdvice(w: WeatherAdviceInput): WeatherAdvice {
  const t = Number(w.feelsLike ?? w.temperature);
  const humid = Number(w.humidity) || 0;
  const wind = Number(w.wind) || 0;
  const icon = w.icon;

  const doList: string[] = [];
  const dontList: string[] = [];

  if (icon === "storm") {
    doList.push(
      "Stay indoors and keep devices charged",
      "Catch up on notes, tickets, or a quiet movie night"
    );
    dontList.push(
      "Avoid outdoor errands and open fields",
      "Skip hanging laundry or leaving windows wide open"
    );
  } else if (icon === "cloud-rain" || icon === "cloud-drizzle") {
    doList.push(
      "Bring an umbrella or light rain jacket",
      "Plan indoor focus work, café time, or family board games"
    );
    dontList.push(
      "Don't schedule picnics or long walks without cover",
      "Avoid leaving bikes or shoes outside"
    );
  } else if (icon === "snow") {
    doList.push(
      "Dress in layers and wear grip-friendly shoes",
      "Good day for hot drinks, reading, or cozy indoor tasks"
    );
    dontList.push(
      "Avoid rushing on untreated sidewalks",
      "Don't leave plants or pipes exposed if it's freezing"
    );
  } else if (icon === "cloud-fog") {
    doList.push(
      "Drive or walk with extra caution and lights on",
      "Use the morning for steady indoor planning"
    );
    dontList.push(
      "Don't take scenic drives for the views",
      "Avoid early outdoor sports until it clears"
    );
  } else if (icon === "sun" || icon === "cloud-sun") {
    if (t >= 32) {
      doList.push(
        "Hydrate often and seek shade midday",
        "Early morning walk or evening outdoor time works best"
      );
      dontList.push(
        "Avoid peak-sun outdoor workouts",
        "Don't leave pets or kids in parked cars"
      );
    } else if (t >= 22) {
      doList.push(
        "Great day for a walk, errands, or outdoor play",
        "Open a window — air out the home"
      );
      dontList.push(
        "Don't sit inside all day if you can step out",
        humid >= 70
          ? "Avoid heavy outdoor exercise in this humidity"
          : "Don't skip sunscreen if you'll be out long"
      );
    } else if (t >= 12) {
      doList.push(
        "Pleasant for a stroll, market run, or patio coffee",
        "Light jacket if you'll be out past evening"
      );
      dontList.push(
        "Don't overdress — you'll warm up walking",
        "Avoid putting off outdoor chores; conditions are friendly"
      );
    } else {
      doList.push(
        "Bundle up for a brisk walk — clear air helps energy",
        "Sunny window seats are good for reading or focus work"
      );
      dontList.push(
        "Don't go out underdressed — wind can feel colder",
        "Avoid long static outdoor waits without gloves"
      );
    }
  } else {
    // overcast / default
    doList.push(
      "Solid day for deep work, errands, or a calm walk",
      "Soft light is nice for photos without harsh glare"
    );
    dontList.push(
      "Don't wait for perfect sun to get outside briefly",
      "Avoid assuming it won't rain — keep a light layer handy"
    );
  }

  if (wind >= 40 && !dontList.some((d) => d.toLowerCase().includes("wind"))) {
    dontList.push("Avoid cycling or umbrellas in strong wind");
  }
  if (humid >= 80 && t >= 26 && icon !== "storm") {
    doList.push("Take cool showers and keep fluids nearby");
  }
  if (!w.isDay && (icon === "sun" || icon === "cloud-sun")) {
    doList.push("Clear evening — nice for a short night walk if it's safe");
  }

  const summary =
    icon === "storm"
      ? "Storm day — prioritize shelter and indoor plans."
      : icon === "cloud-rain" || icon === "cloud-drizzle"
        ? "Wet day — pack rain gear and lean indoor."
        : icon === "snow"
          ? "Snowy — slow down outdoors, warm up indoors."
          : icon === "cloud-fog"
            ? "Foggy — extra caution on the road."
            : t >= 32
              ? "Hot out — pace yourself and hydrate."
              : t <= 5
                ? "Chilly — dress warm if you head out."
                : "Decent conditions — mix outdoor and focus time.";

  return {
    summary,
    doList: doList.slice(0, 3),
    dontList: dontList.slice(0, 3),
  };
}
