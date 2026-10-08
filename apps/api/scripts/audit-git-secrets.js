// Never print values or source lines. Checks reachable local Git objects and known local secrets.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 100 * 1024 * 1024 });
const root = git('rev-parse', '--show-toplevel').trim();
process.chdir(root);
const values = [];
for (const name of ['.env', 'apps/api/.env']) {
  if (!fs.existsSync(name)) continue;
  for (const [key, value] of Object.entries(dotenv.parse(fs.readFileSync(name)))) {
    if (/PASSWORD|SECRET|TOKEN|API_KEY|SERVICE_URI/.test(key) && value.length >= 8) values.push(value);
  }
}
let findings = 0;
function check(label, content) {
  const reasons = [];
  if (values.some(value => content.includes(value))) reasons.push('coincide con secreto local');
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content)) reasons.push('clave privada');
  // This exact literal belongs to the redaction regression test, not a real URI.
  const uriContent = label.includes('apps/api/test/startup.test.js')
    ? content.replaceAll('mysql:' + '//user:${secret}@host', 'mock-uri') : content;
  if (/(?:mysql|postgres(?:ql)?):\/\/[^\s/:]+:[^\s@]+@/i.test(uriContent)) reasons.push('URI con credenciales: revisar');
  if (/(?:ghp_|github_pat_)[A-Za-z0-9_]{30,}/.test(content)) reasons.push('token GitHub');
  if (reasons.length) { findings++; console.log(JSON.stringify({ file: label, reasons })); }
}
const files = git('ls-files', '--cached', '--others', '--exclude-standard').trim().split('\n').filter(Boolean);
for (const file of files) {
  if (fs.existsSync(file) && fs.statSync(file).isFile()) check(`worktree:${file}`, fs.readFileSync(file, 'utf8'));
}
for (const file of git('ls-files').trim().split('\n').filter(Boolean)) {
  try { check(`index:${file}`, git('show', `:${file}`)); } catch { /* missing index entry */ }
}
const objects = git('rev-list', '--objects', '--all').trim().split('\n');
let blobs = 0;
for (const entry of objects) {
  const [id, ...parts] = entry.split(' ');
  if (git('cat-file', '-t', id).trim() !== 'blob') continue;
  blobs++;
  check(`history:${parts.join(' ')}:${id.slice(0, 12)}`, git('cat-file', '-p', id));
}
console.log(JSON.stringify({ files: files.length, historicalBlobs: blobs, findings,
  scope: 'referencias locales; no garantiza ausencia de secretos desconocidos o historial remoto inaccesible' }));
process.exitCode = findings ? 1 : 0;
