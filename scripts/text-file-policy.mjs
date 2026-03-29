import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const args = new Set(process.argv.slice(2));
const shouldWrite = args.has('--write');
const shouldCheck = args.has('--check') || !shouldWrite;

const repoRoot = process.cwd();
const allowedExtensions = new Set(['.md', '.js', '.json', '.html', '.css']);
const ignoredDirectories = new Set(['.git', 'node_modules']);

function listProjectTextFiles(currentDir = repoRoot) {
  const entries = readdirSync(currentDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);
    const relativePath = path.relative(repoRoot, absolutePath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      if (ignoredDirectories.has(entry.name)) {
        continue;
      }

      files.push(...listProjectTextFiles(absolutePath));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (!allowedExtensions.has(path.extname(entry.name))) {
      continue;
    }

    files.push(relativePath);
  }

  return files;
}

function normalizeBuffer(buffer) {
  let offset = 0;

  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    offset = 3;
  }

  const text = buffer.toString('utf8', offset);
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

const dirtyFiles = [];

for (const relativePath of listProjectTextFiles()) {
  const absolutePath = path.join(repoRoot, relativePath);
  const fileStats = statSync(absolutePath);

  if (!fileStats.isFile()) {
    continue;
  }

  const originalBuffer = readFileSync(absolutePath);
  const normalizedText = normalizeBuffer(originalBuffer);
  const normalizedBuffer = Buffer.from(normalizedText, 'utf8');
  const hasChanged = !originalBuffer.equals(normalizedBuffer);

  if (!hasChanged) {
    continue;
  }

  dirtyFiles.push(relativePath);

  if (shouldWrite) {
    writeFileSync(absolutePath, normalizedBuffer);
  }
}

if (dirtyFiles.length === 0) {
  console.log('Text file policy OK.');
  process.exit(0);
}

if (shouldWrite) {
  console.log(`Normalized ${dirtyFiles.length} file(s):`);
  for (const file of dirtyFiles) {
    console.log(`- ${file}`);
  }
  process.exit(0);
}

if (shouldCheck) {
  console.error('Text file policy violations found:');
  for (const file of dirtyFiles) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}