#!/usr/bin/env node

/**
 * CLI entry point for next-pwa-turbo postbuild
 *
 * This script is executed after `next build` to compile the service worker.
 *
 * Usage:
 *   npx next-pwa-turbo
 *   # or in package.json scripts:
 *   "postbuild": "next-pwa-turbo"
 */

import { runPostbuild } from '../dist/build/postbuild.js';

const projectDir = process.cwd();

runPostbuild(projectDir).catch((err) => {
  console.error('[next-pwa-turbo] Build failed:', err.message);
  process.exit(1);
});
