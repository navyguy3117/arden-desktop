import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { VitePlugin } from "@electron-forge/plugin-vite";

const config: ForgeConfig = {
  packagerConfig: {
    name: "Arden Desktop",
    icon: "./arden.ico",
    asar: true,
  },
  makers: [
    new MakerSquirrel({ name: "arden-desktop" }),
    new MakerZIP({}, ["win32", "linux"]),
  ],
  plugins: [
    new VitePlugin({
      build: [
        { entry: "electron/main.ts", config: "vite.main.config.ts", target: "main" },
        { entry: "electron/preload.ts", config: "vite.preload.config.ts", target: "preload" },
      ],
      renderer: [
        { name: "main_window", config: "vite.renderer.config.ts", entry: "renderer/index.html" },
      ],
    }),
  ],
};

export default config;
