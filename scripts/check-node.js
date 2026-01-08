#!/usr/bin/env node
/* eslint-env node */
/* eslint-disable no-console */

const rawVersion = process.versions.node || "0.0.0";
const major = Number(rawVersion.split(".")[0] || 0);
const minMajor = 20;

if (Number.isNaN(major) || major < minMajor) {
  console.error("❌ cccmemory requires Node.js 20 or later.");
  console.error(`   Detected Node.js ${rawVersion}.`);
  console.error("   Please upgrade Node.js and reinstall:");
  console.error("   - nvm install 22 && nvm use 22");
  console.error("   - npm install -g cccmemory");
  process.exit(1);
}
