const fs = require('fs');
const path = require('path');

const baseDir = __dirname;
const assetsDir = path.join(baseDir, 'assets');

let indexContent = fs.readFileSync(path.join(baseDir, 'index.html'), 'utf8');
const cssPath = path.join(assetsDir, '0f75d03d_hencubed.webflow.e5ae0ddfc.min.css');
let cssContent = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';

const assetFiles = fs.readdirSync(assetsDir);

let renamedCount = 0;
for (let oldName of assetFiles) {
    if (oldName.includes('%')) {
        let newName = oldName.replace(/%/g, '_').replace(/[^a-zA-Z0-9.\-_]/g, '_');
        
        fs.renameSync(path.join(assetsDir, oldName), path.join(assetsDir, newName));
        
        indexContent = indexContent.split(oldName).join(newName);
        if (cssContent) {
            cssContent = cssContent.split(oldName).join(newName);
        }
        renamedCount++;
    }
}

fs.writeFileSync(path.join(baseDir, 'index.html'), indexContent, 'utf8');
if (cssContent) {
    fs.writeFileSync(cssPath, cssContent, 'utf8');
}

console.log("Renamed and updated references for", renamedCount, "files.");
