import { defineConfig } from 'zotero-plugin';

export default defineConfig({
  addonID: 'zutilore@altairwei.github.io',
  addonName: 'ZutiloRE',
  id: 'zutilore@altairwei.github.io',
  name: 'ZutiloRE',
  description: 'Zutilo Reloaded - Zotero 7/8 Utility Plugin',
  version: '1.0.0',
  author: 'Altair Wei',
  homeUrl: 'https://github.com/altairwei/ZutiloRE',

  // Entry point
  entry: 'src/index.ts',

  // Manifest
  manifest: 'addon/manifest.json',

  // Zotero version constraints
  zotero: {
    min: '7.0.0',
    max: '8.0.*',
  },

  // Build configuration
  build: {
    outDir: '.scaffold/build',
    assets: [
      'addon/**/*',
    ],
    extraAssets: [
      {
        from: 'icons/',
        to: 'icons/',
      },
    ],
  },

  // Preferences
  prefs: {
    prefix: 'extensions.zotero.zutilore',
  },
});