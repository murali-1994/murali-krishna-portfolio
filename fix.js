const fs = require('fs');
const path = require('path');

const baseDir = __dirname;
const assetsDir = path.join(baseDir, 'assets');

let indexContent = fs.readFileSync(path.join(baseDir, 'index.html'), 'utf8');
const cssPath = path.join(assetsDir, '0f75d03d_hencubed.webflow.e5ae0ddfc.min.css');
let cssContent = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';

const allContent = indexContent + ' ' + cssContent;
// Match href="assets/...", src="assets/...", url("assets/...")
const regex = /(?:href|src|data-src)="assets\/([^"]+)"|url\(['"]?assets\/([^'"\)]+)['"]?\)/g;

let match;
let urls = [];
while ((match = regex.exec(allContent)) !== null) {
    let u = match[1] || match[2];
    urls.push(u);
}

const uniqueUrls = [...new Set(urls)];
const assetFiles = fs.readdirSync(assetsDir);

let renameMap = {}; // oldUrl -> newFileName
let renameDiskMap = {}; // oldFileName -> newFileName

for (let u of uniqueUrls) {
    let cleanName = decodeURIComponent(u).replace(/[^a-zA-Z0-9.\-_]/g, '_');
    
    // Some urls might already be clean and exist
    if (!u.includes('%') && assetFiles.includes(u)) {
        continue; // Perfectly fine
    }

    // It has % or it's a problematic url
    let fileOnDisk = u;
    if (!assetFiles.includes(u)) {
        // Try decoding
        if (assetFiles.includes(decodeURIComponent(u))) {
            fileOnDisk = decodeURIComponent(u);
        } else if (assetFiles.includes(u.replace(/%20/g, '20'))) {
            fileOnDisk = u.replace(/%20/g, '20');
        } else if (assetFiles.includes(u.replace(/%2B/g, '+'))) {
            fileOnDisk = u.replace(/%2B/g, '+');
        } else if (assetFiles.includes(u.replace(/%/g, ''))) {
            fileOnDisk = u.replace(/%/g, '');
        } else {
            console.log("Could not find file on disk for URL:", u);
            continue; // Can't do much
        }
    }
    
    // We have identified the file on disk.
    // If we haven't already decided to rename this file
    if (!renameDiskMap[fileOnDisk]) {
        // Let's create a guaranteed clean name
        // (If the file on disk already has no % and no weird chars, we could keep it,
        // but let's just make sure it's clean and safe)
        let finalName = fileOnDisk.replace(/%/g, '_').replace(/[^a-zA-Z0-9.\-_]/g, '_');
        renameDiskMap[fileOnDisk] = finalName;
    }
    
    renameMap[u] = renameDiskMap[fileOnDisk];
}

// Perform renames on disk
let diskRenamed = 0;
for (let oldFile in renameDiskMap) {
    let newFile = renameDiskMap[oldFile];
    if (oldFile !== newFile) {
        let oldPath = path.join(assetsDir, oldFile);
        let newPath = path.join(assetsDir, newFile);
        if (fs.existsSync(oldPath)) {
            fs.renameSync(oldPath, newPath);
            diskRenamed++;
        }
    }
}

// Update references in index.html
let indexUpdated = 0;
for (let u in renameMap) {
    let newFile = renameMap[u];
    if (u !== newFile) {
        indexContent = indexContent.split(`assets/${u}`).join(`assets/${newFile}`);
        indexUpdated++;
    }
}
fs.writeFileSync(path.join(baseDir, 'index.html'), indexContent, 'utf8');

// Update references in CSS
if (fs.existsSync(cssPath)) {
    let cssUpdated = 0;
    for (let u in renameMap) {
        let newFile = renameMap[u];
        if (u !== newFile) {
            cssContent = cssContent.split(`assets/${u}`).join(`assets/${newFile}`);
            cssUpdated++;
        }
    }
    fs.writeFileSync(cssPath, cssContent, 'utf8');
}

console.log("Disk files renamed:", diskRenamed);
console.log("URLs updated in files:", indexUpdated);
