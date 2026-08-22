import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Android shell loads the hosted Flowdesk URL (same backend as the PWA).
 * Set FLOWDESK_URL when syncing/building, e.g.:
 *   $env:FLOWDESK_URL="https://your-app.vercel.app"; npm run android:sync
 * For local LAN testing use your PC IP, e.g. http://192.168.2.20:3000
 */
const serverUrl =
  process.env.FLOWDESK_URL?.trim() ||
  process.env.CAPACITOR_SERVER_URL?.trim() ||
  "http://192.168.2.20:3000";

const config: CapacitorConfig = {
  appId: "app.flowdesk.family",
  appName: "Flowdesk",
  webDir: "capacitor-www",
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith("http://"),
  },
  android: {
    allowMixedContent: true,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#0d9488",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0d9488",
    },
    LocalNotifications: {
      iconColor: "#0d9488",
      sound: "default",
    },
  },
};

export default config;
