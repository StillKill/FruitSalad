import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

const copyTargets = [
  ['index.html', 'index.html'],
  ['index.js', 'index.js'],
  ['src', 'src'],
  ['assets', 'assets'],
  ['data', 'data'],
  ['node_modules/phaser/dist/phaser.esm.js', 'node_modules/phaser/dist/phaser.esm.js']
];

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

for (const [sourceRelativePath, destinationRelativePath] of copyTargets) {
  const sourcePath = path.join(rootDir, sourceRelativePath);
  const destinationPath = path.join(distDir, destinationRelativePath);

  if (!existsSync(sourcePath)) {
    throw new Error(`Missing build input: ${sourceRelativePath}`);
  }

  mkdirSync(path.dirname(destinationPath), { recursive: true });
  cpSync(sourcePath, destinationPath, { recursive: true });
}

writeFileSync(path.join(distDir, '.nojekyll'), '', 'utf8');

console.log('GitHub Pages build ready in dist/.');