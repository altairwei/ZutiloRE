import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Output directory
const DIST_DIR = 'dist';

// Build configuration (defaults to production; dev.mjs overrides for development)
const buildOptions = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: path.join(DIST_DIR, 'src', 'zutilore.js'),
  format: 'iife',
  target: 'es2022',
  platform: 'browser',
  globalName: 'zutiloRE',
  sourcemap: true,
  minify: true,
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  external: [],
  logLevel: 'info',
};

// Copy addon files - flatten to root of dist
function copyAddonFiles() {
  // Copy addon/* to dist/
  if (fs.existsSync('addon')) {
    copyDirContents('addon', DIST_DIR);
  }

  // Copy install.rdf (required for bootstrap extensions)
  if (fs.existsSync('install.rdf')) {
    fs.copyFileSync('install.rdf', path.join(DIST_DIR, 'install.rdf'));
  }

  // Copy chrome/content (preferences) if exists
  if (fs.existsSync('chrome')) {
    copyDirContents('chrome', DIST_DIR);
  }

  // Copy locale if exists
  if (fs.existsSync('locale')) {
    copyDirContents('locale', DIST_DIR);
  }

  // Copy icons - rename icon.png and icon@2x.png
  if (fs.existsSync('icons')) {
    if (fs.existsSync('icons/icon.png')) {
      fs.copyFileSync('icons/icon.png', path.join(DIST_DIR, 'icon.png'));
    }
    if (fs.existsSync('icons/icon-128.png')) {
      fs.copyFileSync('icons/icon-128.png', path.join(DIST_DIR, 'icon.png'));
    }
    if (fs.existsSync('icons/icon@2x.png')) {
      fs.copyFileSync('icons/icon@2x.png', path.join(DIST_DIR, 'icon@2x.png'));
    }
    if (fs.existsSync('icons/icon-48.png')) {
      fs.copyFileSync('icons/icon-48.png', path.join(DIST_DIR, 'icon-48.png'));
    }
  }
}

function copyDirContents(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      // Create directory and recurse
      if (!fs.existsSync(destPath)) {
        fs.mkdirSync(destPath, { recursive: true });
      }
      copyDirContents(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function build() {
  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }
  console.log('\n>>> Building...');
  await esbuild.build(buildOptions);
  copyAddonFiles();
  console.log('>>> Build complete!\n');
}

// File watcher
function watchFiles() {
  const watchDirs = ['src', 'addon', 'icons'];
  const mtimes = new Map();

  for (const dir of watchDirs) {
    if (fs.existsSync(dir)) {
      scanDir(dir, mtimes);
    }
  }

  console.log('Watching for changes...');
  console.log('   Edit files in src/, addon/, icons/');
  console.log('   Changes will auto-rebuild\n');

  let lastBuild = 0;
  setInterval(() => {
    let changed = false;
    for (const dir of watchDirs) {
      if (fs.existsSync(dir)) {
        if (checkDir(dir, mtimes)) {
          changed = true;
        }
      }
    }

    if (changed) {
      const now = Date.now();
      if (now - lastBuild > 1000) {
        lastBuild = now;
        build();
      }
    }
  }, 500);
}

function scanDir(dir, mtimes) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath, mtimes);
    } else {
      try {
        mtimes.set(fullPath, fs.statSync(fullPath).mtimeMs);
      } catch (e) {}
    }
  }
}

function checkDir(dir, mtimes) {
  let changed = false;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (checkDir(fullPath, mtimes)) {
        changed = true;
      }
    } else {
      try {
        const mtime = fs.statSync(fullPath).mtimeMs;
        if (!mtimes.has(fullPath) || mtimes.get(fullPath) !== mtime) {
          mtimes.set(fullPath, mtime);
          changed = true;
        }
      } catch (e) {}
    }
  }
  return changed;
}

// Exports for use by scripts/dev.mjs
export { buildOptions, build, copyAddonFiles, copyDirContents, DIST_DIR };

// CLI entry point - only runs when executed directly
const __filename_build = fileURLToPath(import.meta.url);
const isMain = path.resolve(process.argv[1] || '') === path.resolve(__filename_build);

if (isMain) {
  const isWatch = process.argv.includes('--watch');

  // Override for watch mode
  if (isWatch) {
    buildOptions.minify = false;
    buildOptions.define['process.env.NODE_ENV'] = '"development"';
  }

  try {
    if (isWatch) {
      await build();
      watchFiles();
    } else {
      await build();
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}
