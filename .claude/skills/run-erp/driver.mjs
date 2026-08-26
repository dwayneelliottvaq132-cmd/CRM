#!/usr/bin/env node
// Headless-Chromium REPL driver for the Texas Precision Plating ERP frontend.
// chromium-cli is not available in this environment, so this is the
// project's stand-in: same nav/wait-for/click/fill/screenshot vocabulary,
// implemented directly on Playwright. Pipe newline-separated commands to
// stdin (see SKILL.md for the full command list).
//
// Usage:
//   node driver.mjs <<'EOF'
//   nav http://localhost:5173
//   wait-for text=Sign in
//   fill input[name=email] m.torres@surftec.com
//   fill input[name=password] surftec-demo
//   click button:has-text("Sign in")
//   wait-for text=Dashboard
//   screenshot dashboard
//   console-errors
//   EOF
//
// Screenshots land in ./screenshots/<name>.png relative to cwd.

import { chromium } from 'playwright';
import readline from 'node:readline';
import path from 'node:path';
import fs from 'node:fs';

const SCREENSHOT_DIR = path.join(process.cwd(), 'screenshots');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

// CHROMIUM_EXECUTABLE_PATH lets a container with a pre-installed Chromium
// (e.g. PLAYWRIGHT_BROWSERS_PATH images) skip `npx playwright install`.
const browser = await chromium.launch({
  args: ['--no-sandbox'],
  ...(process.env.CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH }
    : {}),
});
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => consoleErrors.push(String(err)));

function log(...args) {
  process.stdout.write(args.join(' ') + '\n');
}

async function runLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const [cmd, ...rest] = trimmed.split(' ');
  const arg = rest.join(' ');

  switch (cmd) {
    case 'nav': {
      await page.goto(arg, { waitUntil: 'domcontentloaded' });
      log('ok nav', arg);
      break;
    }
    case 'wait-for': {
      if (arg.startsWith('text=')) {
        await page.getByText(arg.slice(5), { exact: false }).first().waitFor({ timeout: 15000 });
      } else {
        await page.waitForSelector(arg, { timeout: 15000 });
      }
      log('ok wait-for', arg);
      break;
    }
    case 'click': {
      if (arg.startsWith('text=')) {
        await page.getByText(arg.slice(5), { exact: false }).first().click();
      } else if (arg.includes(':has-text(')) {
        const m = arg.match(/^(\w+):has-text\("(.+)"\)$/);
        await page.locator(m[1], { hasText: m[2] }).first().click();
      } else {
        await page.click(arg);
      }
      log('ok click', arg);
      break;
    }
    case 'fill': {
      const sp = arg.indexOf(' ');
      const selector = arg.slice(0, sp);
      const value = arg.slice(sp + 1);
      await page.fill(selector, value);
      log('ok fill', selector);
      break;
    }
    case 'press': {
      await page.keyboard.press(arg);
      log('ok press', arg);
      break;
    }
    case 'sleep': {
      await page.waitForTimeout(Number(arg));
      log('ok sleep', arg);
      break;
    }
    case 'screenshot': {
      const name = arg || 'screenshot';
      const file = path.join(SCREENSHOT_DIR, `${name}.png`);
      await page.screenshot({ path: file, fullPage: true });
      log('ok screenshot', file);
      break;
    }
    case 'console-errors': {
      log('console-errors:', JSON.stringify(consoleErrors));
      break;
    }
    case 'eval': {
      const result = await page.evaluate(arg);
      log('ok eval', JSON.stringify(result));
      break;
    }
    default:
      log('unknown command:', cmd);
  }
}

const rl = readline.createInterface({ input: process.stdin });
for await (const line of rl) {
  try {
    await runLine(line);
  } catch (err) {
    log('ERROR on line:', line, '->', err.message);
  }
}

await browser.close();
