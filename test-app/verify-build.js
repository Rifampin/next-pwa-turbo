/**
 * Verification script for next-pwa-turbo integration test
 *
 * Checks:
 * 1. Build completed successfully
 * 2. PWA manifest was generated
 * 3. Service worker would be placed in public/ (if postbuild runs)
 */

import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const checks = [
  {
    name: '.next directory exists',
    check: () => existsSync(join(__dirname, '.next')),
  },
  {
    name: 'Build manifest exists',
    check: () => existsSync(join(__dirname, '.next', 'build-manifest.json')),
  },
  {
    name: 'App routes compiled',
    check: () => existsSync(join(__dirname, '.next', 'server', 'app')),
  },
  {
    name: 'public/manifest.json exists',
    check: () => existsSync(join(__dirname, 'public', 'manifest.json')),
  },
];

console.log('\n=== next-pwa-turbo Build Verification ===\n');

let passed = 0;
let failed = 0;

for (const { name, check } of checks) {
  try {
    const result = check();
    if (result) {
      console.log(`✓ ${name}`);
      passed++;
    } else {
      console.log(`✗ ${name}`);
      failed++;
    }
  } catch (error) {
    console.log(`✗ ${name} - Error: ${error.message}`);
    failed++;
  }
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);

if (failed > 0) {
  process.exit(1);
}

console.log('Build verification successful!\n');
console.log('Note: Full service worker generation requires running the postbuild script.');
console.log('The Build Adapter integration hooks into Next.js 16 build lifecycle.\n');
