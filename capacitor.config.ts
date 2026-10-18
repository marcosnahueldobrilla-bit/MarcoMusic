import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.marcomusic.app",
  appName: "MARCOMUSIC",
  webDir: "dist-mobile",
  android: { backgroundColor: "#05060f" },
  plugins: {
    SplashScreen: { launchShowDuration: 1200, backgroundColor: "#05060f", showSpinner: false },
  },
};

export default config;
