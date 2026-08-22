import { Capacitor } from "@capacitor/core";

export type DeviceCoords = {
  latitude: number;
  longitude: number;
};

export type DeviceLocationResult =
  | { ok: true; coords: DeviceCoords }
  | { ok: false; reason: "denied" | "unavailable" | "timeout" | "error" };

function browserGeolocation(
  options?: PositionOptions
): Promise<DeviceLocationResult> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve({ ok: false, reason: "unavailable" });
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          ok: true,
          coords: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          },
        }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          resolve({ ok: false, reason: "denied" });
        } else if (err.code === err.TIMEOUT) {
          resolve({ ok: false, reason: "timeout" });
        } else {
          resolve({ ok: false, reason: "unavailable" });
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 6_000,
        maximumAge: 600_000,
        ...options,
      }
    );
  });
}

/** Native Capacitor location first; browser geolocation on web. */
export async function getDeviceLocation(opts?: {
  forceRefresh?: boolean;
}): Promise<DeviceLocationResult> {
  const maximumAge = opts?.forceRefresh ? 0 : 600_000;

  if (Capacitor.isNativePlatform()) {
    try {
      const { Geolocation } = await import("@capacitor/geolocation");
      let perm = await Geolocation.checkPermissions();
      if (perm.location !== "granted" && perm.coarseLocation !== "granted") {
        perm = await Geolocation.requestPermissions();
      }
      if (perm.location !== "granted" && perm.coarseLocation !== "granted") {
        return { ok: false, reason: "denied" };
      }

      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: false,
        timeout: 8_000,
        maximumAge,
      });
      return {
        ok: true,
        coords: {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        },
      };
    } catch {
      // Fall through to WebView geolocation if plugin fails
      return browserGeolocation({ maximumAge, timeout: 6_000 });
    }
  }

  return browserGeolocation({ maximumAge, timeout: 6_000 });
}
