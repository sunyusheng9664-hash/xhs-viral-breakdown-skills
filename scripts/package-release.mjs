#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'skills', 'xhs-viral-breakdown-to-bitable');
const dist = path.join(root, 'dist');
const codexMetadata = path.join(root, 'platforms', 'codex', 'openai.yaml');

function copyClean(from, to) {
  fs.cpSync(from, to, {
    recursive: true,
    filter: (entry) => {
      const name = path.basename(entry);
      return !name.startsWith('._') && name !== '.DS_Store' && name !== 'node_modules';
    },
  });
}

function zipDirectory(stagingRoot, folderName, output) {
  const result = spawnSync('zip', ['-q', '-r', output, folderName, '-x', '*/._*', '*/.DS_Store', '*/node_modules/*'], {
    cwd: stagingRoot,
    encoding: 'utf8',
    env: { ...process.env, COPYFILE_DISABLE: '1' },
  });
  if (result.status !== 0) throw new Error(result.stderr || 'zip 打包失败');
}

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'xhs-skill-release-'));
try {
  for (const platform of ['trae', 'workbuddy', 'codex']) {
    const staging = path.join(temp, platform);
    const target = path.join(staging, 'xhs-viral-breakdown-to-bitable');
    fs.mkdirSync(staging, { recursive: true });
    copyClean(source, target);
    if (platform === 'codex') {
      fs.mkdirSync(path.join(target, 'agents'), { recursive: true });
      fs.copyFileSync(codexMetadata, path.join(target, 'agents', 'openai.yaml'));
    }
    zipDirectory(staging, 'xhs-viral-breakdown-to-bitable', path.join(dist, `xhs-viral-breakdown-to-bitable-${platform}.zip`));
  }
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

process.stdout.write(`${JSON.stringify({ ok: true, dist, files: fs.readdirSync(dist).sort() }, null, 2)}\n`);
