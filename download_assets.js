const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const baseDir = __dirname;
const assetsDir = path.join(baseDir, 'assets');
const htmlFile = path.join(baseDir, 'index.html');

if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir);
}

// Ensure the https agent handles redirects and timeouts gracefully
function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        if (fs.existsSync(dest)) {
            return resolve(dest); // already downloaded
        }
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
            }
            if (response.statusCode !== 200) {
                fs.unlink(dest, () => {});
                return reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(() => resolve(dest));
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => {});
            reject(err);
        });
    });
}

function getFilenameFromUrl(url) {
    try {
        const parsedUrl = new URL(url);
        let pathname = parsedUrl.pathname;
        let ext = path.extname(pathname);
        if (!ext && url.includes('json')) ext = '.json';
        const name = path.basename(pathname);
        // To avoid collisions, prepend a hash of the URL
        const hash = crypto.createHash('md5').update(url).digest('hex').slice(0, 8);
        return `${hash}_${name}`;
    } catch (e) {
        return null;
    }
}

async function processFile(filePath, isHtml) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Regex for href="https://...", src="https://...", and url("https://...")
    // This looks for anything from webflow or cloudfront or other cdn links that seem like assets
    const regexHtml = /(?:href|src|data-src)="([^"]+)"/g;
    const regexCss = /url\(['"]?([^'"()]+)['"]?\)/g;
    
    let match;
    const toDownload = [];
    
    // Match HTML src/href attributes
    let matches = [];
    while ((match = regexHtml.exec(content)) !== null) {
        matches.push(match[1]);
    }
    while ((match = regexCss.exec(content)) !== null) {
        matches.push(match[1]);
    }

    // Process unique URLs
    const uniqueUrls = [...new Set(matches)];
    
    for (let url of uniqueUrls) {
        if (url.startsWith('https://') && 
            (url.includes('uploads-ssl.webflow.com') || 
             url.includes('cloudfront.net') ||
             url.includes('lottiefiles.com') ||
             url.includes('unpkg.com') ||
             url.includes('cdn.jsdelivr.net'))) {
            
            const filename = getFilenameFromUrl(url);
            if (!filename) continue;
            
            const dest = path.join(assetsDir, filename);
            toDownload.push({ url, dest, filename, original: url });
        }
    }

    console.log(`Found ${toDownload.length} assets in ${path.basename(filePath)}`);

    for (let item of toDownload) {
        try {
            console.log(`Downloading ${item.url}...`);
            await downloadFile(item.url, item.dest);
            
            // Rewrite URL in content
            // Need to escape the original URL for global regex replacement
            const safeOriginal = item.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const replaceRegex = new RegExp(`["']?${safeOriginal}["']?`, 'g');
            const newPath = isHtml ? `assets/${item.filename}` : item.filename;
            
            content = content.replace(replaceRegex, `"${newPath}"`);
            
            // If it's a CSS file, we need to recursively process it!
            if (item.filename.endsWith('.css')) {
                await processFile(item.dest, false);
            }
        } catch (e) {
            console.error(`Error downloading ${item.url}:`, e.message);
        }
    }

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated paths in ${path.basename(filePath)}`);
}

async function main() {
    console.log('Starting asset download...');
    fs.copyFileSync(htmlFile, htmlFile + '.backup');
    await processFile(htmlFile, true);
    console.log('Done.');
}

main().catch(console.error);
