const fs = require('fs');
const path = require('path');

const baseDir = __dirname;
const assetsDir = path.join(baseDir, 'assets');

let indexContent = fs.readFileSync(path.join(baseDir, 'index.html'), 'utf8');
const cssPath = path.join(assetsDir, '0f75d03d_hencubed.webflow.e5ae0ddfc.min.css');
let cssContent = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';

const allContent = indexContent + ' ' + cssContent;
const regex = /assets\/([^"'\s\)]+)/g;

let match;
let urls = [];
while ((match = regex.exec(allContent)) !== null) {
    urls.push(match[1]);
}

const urlsWithPercent = [...new Set(urls.filter(u => u.includes('%')))];
console.log('URLs with percent:', urlsWithPercent.length);

// Let's check which files actually exist
let missing = [];
for (let u of urlsWithPercent) {
    if (!fs.existsSync(path.join(assetsDir, u))) {
        missing.push(u);
    }
}
console.log('URLs with percent that DO NOT exist on disk:', missing.length);
missing.forEach(m => console.log(m));
