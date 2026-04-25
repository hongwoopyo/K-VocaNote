import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const frontendDir = path.resolve(__dirname, '../woopyo.netlify.app');
const frontendDistDir = path.resolve(frontendDir, 'dist');
const backendDistDir = path.resolve(__dirname, 'dist');

function run(command, cwd) {
  console.log(`[render-build] ${command} @ ${cwd}`);
  execSync(command, { cwd, stdio: 'inherit' });
}

function copyDirectory(sourceDir, targetDir) {
  const entries = readdirSync(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      mkdirSync(targetPath, { recursive: true });
      copyDirectory(sourcePath, targetPath);
      continue;
    }

    copyFileSync(sourcePath, targetPath);
  }
}

run('npm install', frontendDir);
run('npm run build', frontendDir);

if (!existsSync(frontendDistDir)) {
  throw new Error(`[render-build] Frontend output not found: ${frontendDistDir}`);
}

console.log(`[render-build] Copying ${frontendDistDir} -> ${backendDistDir}`);

try {
  rmSync(backendDistDir, { recursive: true, force: true });
  mkdirSync(backendDistDir, { recursive: true });
  copyDirectory(frontendDistDir, backendDistDir);
} catch (error) {
  console.error('[render-build] Failed while preparing/copying dist:', error);
  throw error;
}

console.log('[render-build] Frontend dist copied to backend/dist');
