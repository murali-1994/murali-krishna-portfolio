require('dotenv').config();
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');
const { globSync } = require('glob');

// Securely load configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const project = process.argv[2];
// Adjust this path if your root assets folder is located elsewhere
const assetsDir = path.join(__dirname, '..', 'assets', project);

// globSync requires forward slashes even on Windows — path.join produces backslashes
const projectRoot = path.join(__dirname, '..').replace(/\\/g, '/');
const sourceCodePattern = `${projectRoot}/**/*.{js,jsx,ts,tsx,html}`;

if (!project) {
  console.log('Usage: node scripts/upload-assets.js <project-folder>');
  process.exit(1);
}

if (!fs.existsSync(assetsDir)) {
  console.error(`Error: Assets folder not found: ${assetsDir}`);
  process.exit(1);
}

// Recursively grab all target images
function getAllImages(dir, baseDir = dir) {
  const files = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...getAllImages(fullPath, baseDir));
    } else if (/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(item)) {
      const relativePath = path.relative(baseDir, fullPath);
      files.push({ fullPath, relativePath, filename: item });
    }
  }
  return files;
}

async function syncAssetsToCloud() {
  const allFiles = getAllImages(assetsDir);
  console.log(`Found ${allFiles.length} images in ${project}/\n`);

  const successfulUploads = [];

  // 1. Process & Upload Images
  for (const { fullPath, relativePath, filename } of allFiles) {
    let folderPath = path.dirname(relativePath).replace(/\\/g, '/');
    if (folderPath === '.') folderPath = '';

    const cloudFolder = folderPath
      ? `murali-krishna-portfolio/${project}/${folderPath}`
      : `murali-krishna-portfolio/${project}`;

    const fileBaseName = path.parse(filename).name;
    const expectedPublicId = `${cloudFolder}/${fileBaseName}`;

    let secureUrl;

    try {
      // Agentic optimization: Check if it already exists to save bandwidth
      const existing = await cloudinary.api.resource(expectedPublicId);
      secureUrl = existing.secure_url;
      console.log(`⚡ Already on Cloudinary: ${relativePath}`);
    } catch (err) {
      try {
        console.log(`▲ Uploading: ${relativePath}...`);
        const result = await cloudinary.uploader.upload(fullPath, {
          folder: cloudFolder,
          resource_type: 'image',
          use_filename: true,
          unique_filename: false,
          overwrite: true
        });
        secureUrl = result.secure_url;
        console.log(`✓ Uploaded successfully`);
      } catch (uploadErr) {
        console.error(`✗ Failed to upload ${relativePath}: ${uploadErr.message}`);
        continue;
      }
    }

    // Normalise to forward slashes (important on Windows)
    const normalisedRelative = relativePath.replace(/\\/g, '/');

    successfulUploads.push({
      // The full logical path as it typically appears in source code, e.g.
      //   assets/my-project/images/hero.png
      logicalPath: `assets/${project}/${normalisedRelative}`,
      absolutePath: fullPath,
      localRelative: normalisedRelative,
      cloudUrl: secureUrl
    });
  }

  // 2. Scan and Update Codebase
  console.log('\n--- Scanning Codebase for References ---\n');
  const sourceFiles = globSync(sourceCodePattern, {
    ignore: ['**/node_modules/**', '**/.next/**', '**/dist/**', '**/build/**']
  });

  let totalReplaced = 0;

  for (const file of sourceFiles) {
    let content = fs.readFileSync(file, 'utf8');
    let fileModified = false;
    let replacedInFile = 0;

    for (const { logicalPath, cloudUrl } of successfulUploads) {
      const escapedLogical = logicalPath.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

      /*
       * Match every real-world prefix variant before "assets/":
       *
       *   "/assets/..."          → leading slash  (HTML src="/assets/...")
       *   "assets/..."           → no prefix
       *   "./assets/..."         → same-dir relative
       *   "../assets/..."        → parent-dir relative
       *   "../../assets/..."     → grandparent relative
       *   "@/assets/..."         → vite/webpack alias
       *
       * (?:(?:\.{1,2}\/)+|\/|@\/)? covers /, ./, ../, ../../, @/
       */
      const regexStr = `(["'\`])(?:(?:\\.{1,2}\\/)+|\\/|@\\/)?${escapedLogical}(["'\`])`;
      const regex = new RegExp(regexStr, 'g');


      if (regex.test(content)) {
        regex.lastIndex = 0;

        let hitCount = 0;
        content = content.replace(regex, (match, openQuote, closeQuote) => {
          hitCount++;
          const q = openQuote === closeQuote ? openQuote : '"';
          return `${q}${cloudUrl}${q}`;
        });

        totalReplaced += hitCount;
        replacedInFile += hitCount;
        fileModified = true;
        console.log(`    ✓ Replaced ${hitCount} reference(s) to ${logicalPath} in ${path.basename(file)}`);
      }
    }

    if (fileModified) {
      fs.writeFileSync(file, content, 'utf8');
      console.log(`✓ Updated: ${path.relative(process.cwd(), file)}`);
    }
  }

  // 3. Agentic Cleanup: Delete local files only after successful URL mapping
  if (totalReplaced === 0) {
    console.log('\n⚠️  No source-code references were found/replaced.');
    console.log('    Keeping local assets for safety.');
    console.log('\n💡 Common reasons:');
    console.log('   • Your code references the file with a different casing or alias');
    console.log('   • The import uses a webpack/vite alias (e.g. @/assets/…) — check logicalPath above');
    console.log('   • The source files are outside the glob pattern');
    console.log('\n🎉 Upload complete. (0 URLs replaced in codebase)');
    return;
  }

  console.log('\n--- Cleaning Up Local Assets ---\n');
  for (const { absolutePath, localRelative } of successfulUploads) {
    try {
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
        console.log(`🚮 Deleted local asset: ${localRelative}`);
      }
    } catch (cleanErr) {
      console.error(`⚠️  Could not delete ${localRelative}:`, cleanErr.message);
    }
  }

  console.log(`\n🎉 Workflow Complete! Replaced ${totalReplaced} URL(s) in the codebase.`);
}

syncAssetsToCloud();