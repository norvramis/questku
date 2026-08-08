#!/usr/bin/env node
// Build: inject src/core/* modules into src/questku.js (marker /*__CORE__*/)
// and emit questku.js + extension/questku.js. Zero dependencies, deterministic.
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const CORE_DIR = path.join(SRC, 'core');
const OUT = [
  path.join(ROOT, 'questku.js'),
  path.join(ROOT, 'extension', 'questku.js'),
];
const MARKER = '/*__CORE__*/';

function read(p) { return fs.readFileSync(p, 'utf8'); }
function write(p, s) { fs.writeFileSync(p, s); }

function removeFunction(src, sig) {
  const tag = '    function ' + sig;
  const start = src.indexOf(tag);
  if (start < 0) throw new Error('not found: ' + sig);
  const open = src.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) {
        let end = i + 1;
        if (src[end] === '\n') end++;
        return src.slice(0, start) + src.slice(end);
      }
    }
  }
  throw new Error('unbalanced braces: ' + sig);
}

function buildCore(coreFiles) {
  const parts = coreFiles.map((f) => {
    const src = read(f);
    return '(function(){ var module={exports:{}}; ' + src + '; return module.exports; })()';
  });
  const assigns = parts.map((p) => 'Object.assign(merged, ' + p + ');').join(' ');
  return 'var __core = (function(){ var merged = {}; ' + assigns + ' return merged; })();';
}

function buildMain() {
  let src = read(path.join(SRC, 'questku.js'));
  if (!src.includes(MARKER)) throw new Error('src/questku.js missing marker ' + MARKER);
  const coreFiles = fs.readdirSync(CORE_DIR)
    .filter((f) => f.endsWith('.js'))
    .sort()
    .map((f) => path.join(CORE_DIR, f));

  const wrapper = [
    buildCore(coreFiles),
    'var getRewardTypes = __core.getRewardTypes;',
    'var getOrbValue = function(rewards){ return __core.getOrbValue(rewards, userPremiumType); };',
    'var getRewardHtml = function(q){ return __core.getRewardHtml(q, { premiumType: userPremiumType, nitroBadge: NITRO_BADGE }); };',
    'var isExpired = function(q){ return __core.isExpired(q, Date.now()); };',
    'var isDesktopOnlyQuest = function(q){ return __core.isDesktopOnlyQuest(q, isDesktop); };',
    'var apiReq = function(method, url, body){ return __core.apiReq({ api: Q.api, maxRetries: set.maxRetries, logRate: function(m){ log.i(m); }, logRetry: function(m){ log.i(m); }, sleep: function(secs){ return sleepSec(secs); } }, method, url, body); };',
  ].join('\n    ');
  return src.replace(MARKER, wrapper);
}

const out = buildMain();
for (const p of OUT) write(p, out);
console.log('build ok -> questku.js, extension/questku.js (' + out.length + ' bytes)');