/**
 * Install plugin to default Zotero profile
 * This script copies the built plugin to your existing Zotero profile
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');

console.log('DEBUG: PROJECT_ROOT =', PROJECT_ROOT);
console.log('DEBUG: DIST_DIR =', DIST_DIR);
console.log('DEBUG: exists =', fs.existsSync(DIST_DIR));

function findDefaultProfile() {
  // Hardcoded for now - use your actual default profile path
  const profileDir = path.join(
    process.env.HOME || '',
    'Library/Application Support/Zotero',
    'Profiles/vtcu7oel.default'
  );

  if (!fs.existsSync(profileDir)) {
    throw new Error(`Profile not found: ${profileDir}`);
  }

  return profileDir;
}

function install() {
  console.log('Finding default profile...');

  const profileDir = findDefaultProfile();
  console.log(`Profile: ${profileDir}`);

  // Ensure extensions directory exists
  const extDir = path.join(profileDir, 'extensions');
  if (!fs.existsSync(extDir)) {
    fs.mkdirSync(extDir, { recursive: true });
  }

  const ADDON_ID = 'zutilore@altairwei.github.io';
  const XPI_PATH = path.join(PROJECT_ROOT, '.scaffold', 'build', 'zutilore.xpi');

  // Build XPI first if needed
  if (!fs.existsSync(XPI_PATH)) {
    console.log('Building XPI...');
    execSync('node scripts/build-xpi.mjs', { cwd: PROJECT_ROOT, stdio: 'inherit' });
  }

  // Copy XPI to extensions folder
  console.log('Installing XPI...');
  fs.copyFileSync(XPI_PATH, path.join(extDir, `${ADDON_ID}.xpi`));

  // Create JSON config
  const extJson = {
    id: ADDON_ID,
    installDate: Date.now(),
    version: '1.0.0',
    active: true,
    userDisabled: false,
    appDisabled: false,
    type: 'extension',
  };
  fs.writeFileSync(
    path.join(extDir, `${ADDON_ID}.json`),
    JSON.stringify(extJson, null, 2)
  );

  console.log(`✅ Plugin installed!`);
  console.log('');
  console.log('Please RESTART Zotero to see the plugin.');
}

install();