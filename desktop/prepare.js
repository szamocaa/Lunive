// Puts the game into desktop/app/: the website's index.html with three.js bundled next to it
// (so the app needs no CDN), the icon, and the game's version copied into package.json.
const fs = require('fs');
const path = require('path');

const here = __dirname, out = path.join(here, 'app');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

let html = fs.readFileSync(path.join(here, '..', 'index.html'), 'utf8');
const cdn = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
if (!html.includes(cdn)) throw new Error('three.js <script> tag not found in index.html');
html = html.split(cdn).join('three.min.js');
fs.writeFileSync(path.join(out, 'index.html'), html);
fs.copyFileSync(path.join(here, 'vendor', 'three.min.js'), path.join(out, 'three.min.js'));
fs.copyFileSync(path.join(here, 'build', 'icon.png'), path.join(out, 'icon.png'));

const m = html.match(/LUNIVE_VER='([0-9]+\.[0-9]+\.[0-9]+)'/);
if (!m) throw new Error('LUNIVE_VER not found in index.html');
const pkgFile = path.join(here, 'package.json'), pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
pkg.version = m[1];
fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + '\n');
console.log('Lunive ' + m[1] + ' is ready to package (' + (html.length / 1e6).toFixed(1) + ' MB)');
