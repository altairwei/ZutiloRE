/**
 * Build XPI package
 */
import { mkdir, readdir, writeFile, copyFile } from 'fs/promises';
import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const DIST_DIR = join(PROJECT_ROOT, 'dist');
const OUTPUT_DIR = join(PROJECT_ROOT, '.scaffold', 'build');

async function buildXPI() {
  console.log('Building XPI...');

  // Ensure output directory exists
  await mkdir(OUTPUT_DIR, { recursive: true });

  const zip = new AdmZip();

  // Add files from dist directory to ROOT of XPI
  await addDirectoryToZip(zip, DIST_DIR, '');

  // Generate filename with timestamp
  const now = new Date();
  const timestamp = now.toISOString().slice(0, 19).replace(/[T:]/g, '-');
  const xpiName = `zutilore-v1.0.0-${timestamp}.xpi`;
  const xpiPath = join(OUTPUT_DIR, xpiName);
  zip.writeZip(xpiPath);

  // Also keep a latest version
  const latestPath = join(OUTPUT_DIR, 'zutilore.xpi');
  fs.copyFileSync(xpiPath, latestPath);

  // Copy to Downloads for easy access
  const downloadsPath = join(process.env.HOME, 'Downloads', xpiName);
  fs.copyFileSync(xpiPath, downloadsPath);
  console.log(`Copied to Downloads: ${downloadsPath}`);

  console.log(`XPI created: ${xpiPath}`);

  // Update manifest
  const manifest = {
    addons: {
      'zutilore@altairwei.github.io': {
        version: '1.0.0',
        updateInfoURL: 'https://raw.githubusercontent.com/altairwei/ZutiloRE/main/updates.json',
      },
    },
  };

  await writeFile(
    join(OUTPUT_DIR, 'update.json'),
    JSON.stringify(manifest, null, 2)
  );

  console.log('Build complete!');
}

async function addDirectoryToZip(zip, dir, baseDir) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    // Preserve directory structure relative to dist/
    const zipPath = baseDir ? join(baseDir, entry.name) : entry.name;

    if (entry.isDirectory()) {
      await addDirectoryToZip(zip, fullPath, zipPath);
    } else {
      zip.addLocalFile(fullPath, baseDir);
    }
  }
}

buildXPI().catch(console.error);