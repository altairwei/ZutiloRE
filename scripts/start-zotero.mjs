/**
 * ZutiloRE - Start Zotero with Plugin
 * Installs plugin and launches Zotero
 */
import { cpSync, mkdirSync, existsSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const XPI_PATH = join(PROJECT_ROOT, '.scaffold', 'build', 'zutilore.xpi');

// Find default profile
const ZOTERO_HOME = join(process.env.HOME || '', 'Library/Application Support/Zotero');
const PROFILES_INI = join(ZOTERO_HOME, 'profiles.ini');

// Find the default profile path
function findDefaultProfile() {
  const content = readFileSync(PROFILES_INI, 'utf-8');
  const defaultMatch = content.match(/Default=1\s*\n\[Profile(\d+)\]/);
  if (defaultMatch) {
    const profileNum = defaultMatch[1];
    const pathMatch = content.match(new RegExp(`\\[Profile${profileNum}\\]\\s*Path=(.+)`));
    if (pathMatch) {
      return pathMatch[1];
    }
  }
  // Fallback
  return 'profiles/vtcu7oel.default';
}

const PROFILE_PATH = findDefaultProfile();
const PROFILE_DIR = join(ZOTERO_HOME, PROFILE_PATH);
const EXT_DIR = join(PROFILE_DIR, 'extensions');
const ADDON_ID = 'zutilore@altairwei.github.io';

function installPlugin() {
  console.log('Installing plugin to profile...');
  console.log(`Profile: ${PROFILE_PATH}`);

  // Ensure extensions directory exists
  if (!existsSync(EXT_DIR)) {
    mkdirSync(EXT_DIR, { recursive: true });
  }

  // Copy XPI to extensions directory
  cpSync(XPI_PATH, join(EXT_DIR, `${ADDON_ID}.xpi`), { force: true });

  // Create extension JSON
  const extJson = {
    id: ADDON_ID,
    installDate: Date.now(),
    version: '1.0.0',
    active: true,
    userDisabled: false,
    appDisabled: false,
    type: 'extension',
    scope: 1,
    installType: 1,
  };

  writeFileSync(
    join(EXT_DIR, `${ADDON_ID}.json`),
    JSON.stringify(extJson, null, 2)
  );

  console.log('Plugin installed!');
}

function startZotero() {
  console.log('Starting Zotero...');

  // Try different Zotero locations
  const zoteroPaths = [
    '/Applications/Zotero.app/Contents/MacOS/zotero',
    '/Applications/Zotero Beta.app/Contents/MacOS/zotero',
  ];

  let zoteroPath = null;
  for (const p of zoteroPaths) {
    if (existsSync(p)) {
      zoteroPath = p;
      break;
    }
  }

  if (!zoteroPath) {
    console.error('Zotero not found!');
    process.exit(1);
  }

  // Start Zotero normally (will use default profile)
  execSync(`"${zoteroPath}"`, {
    stdio: 'inherit',
    cwd: PROJECT_ROOT,
    detached: true,
  });

  console.log('Zotero started!');
}

// Main
installPlugin();
startZotero();