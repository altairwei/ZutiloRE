/**
 * ZutiloRE - Unified Development Script
 *
 * Usage:
 *   node scripts/dev.mjs              # serve: build + install + launch Zotero + watch
 *   node scripts/dev.mjs serve        # same as above
 *   node scripts/dev.mjs build        # one-time build + install proxy file
 *   node scripts/dev.mjs log          # show last 100 lines of Zotero log
 *   node scripts/dev.mjs log -n 50    # show last 50 lines
 *   node scripts/dev.mjs serve --no-launch  # serve without launching Zotero
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn, execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { parseArgs } from 'util';

import { buildOptions, build, DIST_DIR } from '../build.mjs';

// ----- Constants -----

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const ADDON_ID = 'zutilore@altairwei.github.io';
const LOGS_DIR = path.join(PROJECT_ROOT, 'logs');
const LOG_FILE = path.join(LOGS_DIR, 'zotero.log');

const WATCH_DIRS = ['src', 'addon', 'chrome', 'locale', 'icons'];
const WATCH_ROOT_FILES = ['bootstrap.js', 'manifest.json', 'install.rdf'];

// ----- Utility Functions -----

function formatTime() {
  const now = new Date();
  return now.toLocaleTimeString('en-US', { hour12: false });
}

function log(prefix, message) {
  console.log(`[${formatTime()}] [${prefix}] ${message}`);
}

function formatLogLine(prefix, message) {
  return `[${formatTime()}] [${prefix}] ${message}`;
}

function writeTrigger() {
  const triggerPath = path.join(PROJECT_ROOT, DIST_DIR, '.reload-trigger');
  fs.writeFileSync(triggerPath, String(Date.now()), 'utf-8');
}

// ----- INI Parser -----

function parseIni(content) {
  const sections = {};
  let currentSection = null;

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;

    const sectionMatch = line.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      sections[currentSection] = {};
      continue;
    }

    const kvMatch = line.match(/^([^=]+)=(.*)$/);
    if (kvMatch && currentSection) {
      sections[currentSection][kvMatch[1].trim()] = kvMatch[2].trim();
    }
  }

  return sections;
}

// ----- Config Discovery -----

function findZoteroBin() {
  // 1. Env var override
  if (process.env.ZOTERO_BIN) {
    if (!fs.existsSync(process.env.ZOTERO_BIN)) {
      throw new Error(`ZOTERO_BIN not found: ${process.env.ZOTERO_BIN}`);
    }
    return process.env.ZOTERO_BIN;
  }

  // 2. zotero-plugin.ini — host-specific section [zotero.<hostname>] takes
  //    priority over the generic [zotero] section.
  const pluginIni = path.join(PROJECT_ROOT, 'zotero-plugin.ini');
  if (fs.existsSync(pluginIni)) {
    const sections = parseIni(fs.readFileSync(pluginIni, 'utf-8'));
    const hostname = os.hostname();
    const zoteroCfg = sections[`zotero.${hostname}`] ?? sections.zotero;
    if (zoteroCfg?.path && fs.existsSync(zoteroCfg.path)) {
      return zoteroCfg.path;
    }
  }

  // 3. Well-known locations
  const candidates = [
    '/Applications/Zotero.app/Contents/MacOS/zotero',
    '/Applications/Zotero Beta.app/Contents/MacOS/zotero',
    path.join(os.homedir(), 'Applications/Zotero.app/Contents/MacOS/zotero'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }

  throw new Error(
    'Zotero binary not found.\n' +
    '  Set ZOTERO_BIN env var or update zotero-plugin.ini [zotero] path'
  );
}

function findProfileDir() {
  // 1. Env var override
  if (process.env.ZOTERO_PROFILE_DIR) {
    const dir = process.env.ZOTERO_PROFILE_DIR;
    if (!fs.existsSync(dir)) {
      throw new Error(`ZOTERO_PROFILE_DIR not found: ${dir}`);
    }
    return dir;
  }

  // 2. zotero-plugin.ini — host-specific section [profile.<hostname>] takes
  //    priority over the generic [profile] section.
  const pluginIni = path.join(PROJECT_ROOT, 'zotero-plugin.ini');
  if (fs.existsSync(pluginIni)) {
    const sections = parseIni(fs.readFileSync(pluginIni, 'utf-8'));
    const hostname = os.hostname();
    const profileCfg = sections[`profile.${hostname}`] ?? sections.profile;
    if (profileCfg?.path && fs.existsSync(profileCfg.path)) {
      return profileCfg.path;
    }
  }

  // 3. Auto-discovery from profiles.ini
  const zoteroHome = path.join(os.homedir(), 'Library/Application Support/Zotero');
  const profilesIni = path.join(zoteroHome, 'profiles.ini');
  if (!fs.existsSync(profilesIni)) {
    throw new Error(
      'Cannot find Zotero profiles.ini.\n' +
      '  Set ZOTERO_PROFILE_DIR env var or update zotero-plugin.ini [profile] path'
    );
  }

  const sections = parseIni(fs.readFileSync(profilesIni, 'utf-8'));

  // Find section with Default=1
  for (const [name, props] of Object.entries(sections)) {
    if (!name.toLowerCase().startsWith('profile')) continue;
    if (props.Default !== '1') continue;

    const profilePath = props.IsRelative === '1'
      ? path.join(zoteroHome, props.Path)
      : props.Path;

    if (fs.existsSync(profilePath)) return profilePath;
  }

  throw new Error(
    'No default Zotero profile found in profiles.ini.\n' +
    '  Set ZOTERO_PROFILE_DIR env var or update zotero-plugin.ini [profile] path'
  );
}

// ----- Proxy File Install -----

function installProxyFile(profileDir) {
  const extDir = path.join(profileDir, 'extensions');
  fs.mkdirSync(extDir, { recursive: true });

  const proxyFile = path.join(extDir, ADDON_ID);
  const distAbsPath = path.resolve(PROJECT_ROOT, DIST_DIR);

  // Remove old XPI install if present
  const oldXpi = path.join(extDir, `${ADDON_ID}.xpi`);
  if (fs.existsSync(oldXpi)) {
    fs.unlinkSync(oldXpi);
    log('dev', 'Removed old XPI install');
  }

  // Remove old JSON descriptor if present
  const oldJson = path.join(extDir, `${ADDON_ID}.json`);
  if (fs.existsSync(oldJson)) {
    fs.unlinkSync(oldJson);
  }

  // Remove staged uninstall marker left by Zotero when user uninstalls
  // from the UI. If this directory exists, Zotero will process the pending
  // uninstall on startup and undo everything we set up here.
  const stagedDir = path.join(extDir, 'staged', ADDON_ID);
  if (fs.existsSync(stagedDir)) {
    fs.rmSync(stagedDir, { recursive: true, force: true });
    log('dev', 'Removed staged uninstall directory');
    // Remove the staged parent dir if it is now empty
    const stagedParent = path.join(extDir, 'staged');
    try {
      const remaining = fs.readdirSync(stagedParent);
      if (remaining.length === 0) fs.rmdirSync(stagedParent);
    } catch { /* ignore */ }
  }

  // Delete addonStartup.json.lz4 — Zotero's fast-startup cache.
  // If the addon was uninstalled, this cache will not contain our entry and
  // Zotero will skip the proxy file entirely. Removing it forces a full
  // rescan of the extensions directory on next launch.
  const startupCache = path.join(profileDir, 'addonStartup.json.lz4');
  if (fs.existsSync(startupCache)) {
    fs.unlinkSync(startupCache);
    log('dev', 'Removed addonStartup.json.lz4 (will be rebuilt on launch)');
  }

  // Ensure sideloaded addons (proxy files) are not auto-disabled.
  // Zotero inherits Firefox's extensions.autoDisableScopes which disables
  // newly discovered sideloaded addons by default. Writing to user.js
  // guarantees the pref is applied every startup without being overwritten.
  ensureDevPrefs(profileDir);

  // Write proxy file: a text file containing the path to dist/
  fs.writeFileSync(proxyFile, distAbsPath + '\n', 'utf-8');

  log('dev', `Proxy file: ${proxyFile}`);
  log('dev', `  -> ${distAbsPath}`);

  // Patch extensions.json so Zotero loads from the directory, not a stale XPI path
  patchExtensionsJson(profileDir, distAbsPath);
}

function ensureDevPrefs(profileDir) {
  const userJsPath = path.join(profileDir, 'user.js');
  const prefLine = 'user_pref("extensions.autoDisableScopes", 0);';

  let content = '';
  if (fs.existsSync(userJsPath)) {
    content = fs.readFileSync(userJsPath, 'utf-8');
    if (content.includes('extensions.autoDisableScopes')) return;
  }

  const lines = [
    content.trimEnd(),
    '',
    '// Added by ZutiloRE dev script — prevent auto-disabling sideloaded addons',
    prefLine,
    '',
  ].filter((line, i) => i > 0 || line !== '');  // drop leading blank if file was empty

  fs.writeFileSync(userJsPath, lines.join('\n'), 'utf-8');
  log('dev', 'Set extensions.autoDisableScopes=0 in user.js');
}

function patchExtensionsJson(profileDir, distAbsPath) {
  const extJsonPath = path.join(profileDir, 'extensions.json');
  if (!fs.existsSync(extJsonPath)) return;

  let data;
  try {
    data = JSON.parse(fs.readFileSync(extJsonPath, 'utf-8'));
  } catch {
    return;
  }

  const addons = data.addons;
  if (!Array.isArray(addons)) return;

  // Build a file:// rootURI pointing to distAbsPath (with trailing slash)
  const rootURI = 'file://' + distAbsPath.replace(/ /g, '%20') + '/';

  const idx = addons.findIndex(a => a.id === ADDON_ID);
  if (idx === -1) {
    // Addon entry was removed (e.g. user uninstalled from Zotero UI).
    // Re-create the entry so Zotero recognises the proxy file on next startup.
    addons.push({
      id: ADDON_ID,
      location: 'app-profile',
      version: '1.0.0',
      type: 'extension',
      loader: null,
      updateURL: null,
      optionsURL: null,
      aboutURL: null,
      defaultLocale: { name: 'ZutiloRE', description: 'Zutilo Reloaded - Zotero Utility Plugin' },
      visible: true,
      active: true,
      userDisabled: false,
      appDisabled: false,
      installDate: Date.now(),
      updateDate: Date.now(),
      applyBackgroundUpdates: 1,
      path: distAbsPath,
      rootURI: rootURI,
      softDisabled: false,
      foreignInstall: false,
      seen: true,
      startupData: null,
    });
    log('dev', `Added addon entry to extensions.json (was missing after uninstall)`);
  } else {
    addons[idx].path = distAbsPath;
    addons[idx].rootURI = rootURI;
    // Reset any disabled/uninstalled flags that Zotero may have set
    addons[idx].active = true;
    addons[idx].userDisabled = false;
    addons[idx].appDisabled = false;
    addons[idx].visible = true;
    log('dev', `Patched extensions.json: rootURI -> ${rootURI}`);
  }

  fs.writeFileSync(extJsonPath, JSON.stringify(data, null, 2), 'utf-8');
}

// ----- Zotero Process -----

function isZoteroRunning() {
  try {
    execSync('pgrep -x zotero', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function launchZotero(profileDir) {
  const bin = findZoteroBin();

  // Ensure log directory exists
  fs.mkdirSync(LOGS_DIR, { recursive: true });

  // Truncate log file on new session
  const logStream = fs.createWriteStream(LOG_FILE, { flags: 'w' });

  // Write session header
  const header = `--- ZutiloRE dev session started at ${new Date().toISOString()} ---\n`;
  logStream.write(header);

  log('dev', `Launching: ${bin}`);
  log('dev', `Profile: ${profileDir}`);
  log('dev', `Log file: ${LOG_FILE}`);

  const args = [
    '-profile', profileDir,
    '-ZoteroDebugText',
    '-purgecaches',
    '-jsconsole',
  ];

  const child = spawn(bin, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Process and write Zotero output
  function handleOutput(data) {
    const text = data.toString();
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      const formatted = formatLogLine('zotero', line);
      process.stdout.write(formatted + '\n');
      logStream.write(formatted + '\n');
    }
  }

  child.stdout.on('data', handleOutput);
  child.stderr.on('data', handleOutput);

  child.on('exit', (code, signal) => {
    logStream.end();
    if (signal) {
      log('dev', `Zotero terminated by signal: ${signal}`);
    } else {
      log('dev', `Zotero exited with code: ${code}`);
    }
  });

  return { child, logStream };
}

// ----- Clean Shutdown -----

function setupShutdownHandlers(zoteroChild, logStream) {
  let isShuttingDown = false;

  async function shutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    log('dev', `Received ${signal}, shutting down...`);

    // Check if Zotero process is still alive (exitCode/signalCode are set once it exits)
    const isAlive = zoteroChild &&
      zoteroChild.exitCode === null &&
      zoteroChild.signalCode === null &&
      !zoteroChild.killed;

    if (isAlive) {
      zoteroChild.kill('SIGTERM');

      // Force kill after 5 seconds
      const killTimer = setTimeout(() => {
        if (!zoteroChild.killed) {
          log('dev', 'Force killing Zotero...');
          zoteroChild.kill('SIGKILL');
        }
      }, 5000);
      killTimer.unref();

      await new Promise(resolve => {
        zoteroChild.on('exit', resolve);
      });
    }

    if (logStream) logStream.end();

    log('dev', 'Shutdown complete.');
    process.exit(0);
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// ----- File Watcher -----

function startWatcher() {
  let debounceTimer = null;
  let isBuilding = false;

  async function onChangeDetected(eventType, filename) {
    // Skip dotfiles and node_modules
    if (filename && (filename.startsWith('.') || filename.includes('node_modules'))) return;

    if (debounceTimer) clearTimeout(debounceTimer);

    debounceTimer = setTimeout(async () => {
      if (isBuilding) return;
      isBuilding = true;

      const changedFile = filename || 'unknown';
      log('dev', `Change detected: ${changedFile}`);

      const start = Date.now();
      try {
        await build();
        writeTrigger();
        log('dev', `Rebuild complete (${Date.now() - start}ms) - hot reload triggered`);
      } catch (err) {
        log('dev', `Rebuild FAILED: ${err.message}`);
      } finally {
        isBuilding = false;
      }
    }, 300);
  }

  // Watch directories
  for (const dir of WATCH_DIRS) {
    const absDir = path.join(PROJECT_ROOT, dir);
    if (!fs.existsSync(absDir)) continue;

    fs.watch(absDir, { recursive: true }, onChangeDetected);
    log('dev', `  Watching: ${dir}/`);
  }

  // Watch root-level files
  for (const file of WATCH_ROOT_FILES) {
    const absFile = path.join(PROJECT_ROOT, file);
    if (!fs.existsSync(absFile)) continue;

    fs.watch(absFile, onChangeDetected);
    log('dev', `  Watching: ${file}`);
  }
}

// ----- Mode Handlers -----

async function modeServe(options) {
  log('dev', '========================================');
  log('dev', '  ZutiloRE Development Server');
  log('dev', '========================================');
  log('dev', '');

  // Step 1: Configure build for development
  buildOptions.minify = false;
  buildOptions.define['process.env.NODE_ENV'] = '"development"';

  // Step 2: Build
  log('dev', '[1/4] Building TypeScript...');
  const start = Date.now();
  await build();
  writeTrigger();
  log('dev', `Build complete (${Date.now() - start}ms)`);

  // Step 3: Install proxy file
  log('dev', '[2/4] Installing proxy file...');
  const profileDir = findProfileDir();
  installProxyFile(profileDir);

  // Step 4: Launch Zotero (unless --no-launch)
  let zoteroProcess = null;
  if (!options.noLaunch) {
    if (isZoteroRunning()) {
      log('dev', '[3/4] Zotero is already running - skipping launch');
      log('dev', '  Restart Zotero manually to load updated plugin');
      // Still set up log capture for existing output
      fs.mkdirSync(LOGS_DIR, { recursive: true });
    } else {
      log('dev', '[3/4] Launching Zotero...');
      zoteroProcess = launchZotero(profileDir);
      setupShutdownHandlers(zoteroProcess.child, zoteroProcess.logStream);
    }
  } else {
    log('dev', '[3/4] Skipping Zotero launch (--no-launch)');
  }

  // Step 5: Start watcher
  log('dev', '[4/4] Starting file watcher...');
  startWatcher();

  log('dev', '');
  log('dev', 'Dev server ready. Watching for changes...');
  log('dev', 'Hot reload is active - file changes will auto-reload the plugin.');
  log('dev', `Log file: ${LOG_FILE}`);
  log('dev', 'Press Ctrl+C to stop.');
}

async function modeBuild() {
  log('dev', 'ZutiloRE - One-Time Build');
  log('dev', '');

  // Configure for development
  buildOptions.minify = false;
  buildOptions.define['process.env.NODE_ENV'] = '"development"';

  // Build
  const start = Date.now();
  await build();
  log('dev', `Build complete (${Date.now() - start}ms)`);

  // Install proxy file
  const profileDir = findProfileDir();
  installProxyFile(profileDir);

  log('dev', '');
  log('dev', 'Build and install complete.');
  log('dev', 'Restart Zotero to load the plugin.');
}

function modeLog(options) {
  if (!fs.existsSync(LOG_FILE)) {
    log('dev', `No log file found at ${LOG_FILE}`);
    log('dev', 'Run "npm run dev" first to generate logs.');
    process.exit(1);
  }

  const lines = parseInt(options.lines || '100', 10);
  const content = fs.readFileSync(LOG_FILE, 'utf-8');
  const allLines = content.split('\n');
  const lastN = allLines.slice(-lines).join('\n');

  console.log(lastN);
}

// ----- CLI Entry Point -----

const { values, positionals } = parseArgs({
  options: {
    help: { type: 'boolean', short: 'h' },
    'no-launch': { type: 'boolean' },
    lines: { type: 'string', short: 'n', default: '100' },
  },
  allowPositionals: true,
  strict: false,
});

const mode = positionals[0] || 'serve';

if (values.help) {
  console.log(`
ZutiloRE Development Script

Usage:
  node scripts/dev.mjs [command] [options]

Commands:
  serve       Build + install + launch Zotero + watch (default)
  build       One-time build + install proxy file
  log         Show recent Zotero log entries

Options:
  --no-launch   Don't launch Zotero (serve mode only)
  -n, --lines   Number of log lines to show (log mode, default: 100)
  -h, --help    Show this help

NPM shortcuts:
  npm run dev           # serve mode
  npm run dev:build     # build mode
  npm run dev:log       # log mode
`);
  process.exit(0);
}

try {
  switch (mode) {
    case 'serve':
      await modeServe({ noLaunch: values['no-launch'] });
      break;
    case 'build':
      await modeBuild();
      break;
    case 'log':
      modeLog({ lines: values.lines });
      break;
    default:
      console.error(`Unknown command: ${mode}`);
      console.error('Run with --help for usage.');
      process.exit(1);
  }
} catch (error) {
  log('dev', `ERROR: ${error.message}`);
  process.exit(1);
}
