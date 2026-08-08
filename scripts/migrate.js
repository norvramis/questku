#!/usr/bin/env node
// ONE-TIME migration: current questku.js -> src/questku.js with the reward
// helpers removed and the /*__CORE__*/ marker inserted. Run before editing src/.
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');

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
  throw new Error('unbalanced: ' + sig);
}

let src = fs.readFileSync(path.join(ROOT, 'questku.js'), 'utf8');
const markerIdx = src.indexOf('    function getRewardTypes');

src = removeFunction(src, 'getRewardHtml(q) {');
src = removeFunction(src, 'getRewardTypes(q) {');
src = removeFunction(src, 'getOrbValue(rewards) {');

src = src.slice(0, markerIdx) + '    /*__CORE__*/\n' + src.slice(markerIdx);
fs.writeFileSync(path.join(ROOT, 'src', 'questku.js'), src);
console.log('src/questku.js written (' + src.length + ' bytes)');