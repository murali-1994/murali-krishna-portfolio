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
// Define where your code lives (e.g., 'src', 'app', or root directory components)
const sourceCodePattern = path.join(__dirname, '..', '**/*.{js,jsx,ts,tsx,html}');

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

    // Use the filename without extension as the public ID to check existence easily
    const fileBaseName = path.parse(filename).name;
    const expectedPublicId = `${cloudFolder}/${fileBaseName}`;

    let secureUrl;

    try {
      // Agentic optimization: Check if it already exists to save bandwidth
      const existing = await cloudinary.api.resource(expectedPublicId);
      secureUrl = existing.secure_url;
      console.log(`⚡ Already on Cloudinary: ${relativePath}`);
    } catch (err) {
      // If it doesn't exist (returns 404), upload it
      try {
        console.log(`▲ Uploading: ${relativePath}...`);
        const result = await cloudinary.uploader.upload(fullPath, {
          folder: cloudFolder,
          resource_type: 'image',
          use_filename: true,
          unique_filename: false, // Ensures consistent naming
          overwrite: true
        });
        secureUrl = result.secure_url;
        console.log(`✓ Uploaded successfully`);
      } catch (uploadErr) {
        console.error(`✗ Failed to upload ${relativePath}: ${uploadErr.message}`);
        continue; // Skip code replacement if upload fails
      }
    }

    successfulUploads.push({
      localPath: relativePath,
      absolutePath: fullPath,
      cloudUrl: secureUrl
    });
  }

  // 2. Scan and Update Codebase
  console.log('\n--- Scanning Codebase for References ---\n');

  // Exclude node_modules and build directories from scan
  const sourceFiles = globSync(sourceCodePattern, {
    ignore: ['**/node_modules/**', '**/.next/**', '**/dist/**', '**/build/**']
  });

  let totalReplaced = 0;

  for (const file of sourceFiles) {
    let content = fs.readFileSync(file, 'utf8');
    let fileModified = false;

    for (const { localPath, cloudUrl } of successfulUploads) {
      // Standardize path formats for regex matching
      const cleanLocalPath = localPath.replace(/\\/g, '/');

      // Matches typical patterns: /assets/project/image.png OR assets/project/image.png OR ../assets/project/image.png
      const escapedPath = cleanLocalPath.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`['"\`].*?assets/${project}/${escapedPath}['"\`]`, 'g');

      const matches = content.match(regex);
      if (matches) {
        // Replace the whole path string inside the quotes with the new Cloudinary URL
        content = content.replace(regex, `"${cloudUrl}"`);
        totalReplaced += matches.length;
        fileModified = true;
      }
    }

    if (fileModified) {
      fs.writeFileSync(file, content, 'utf8');
      console.log(`✓ Updated references in: ${path.relative(process.cwd(), file)}`);
    }
  }

  // 3. Agentic Cleanup: Delete the local files only after successful URL mapping
  console.log('\n--- Cleaning Up Local Assets ---\n');
  for (const { absolutePath, localPath } of successfulUploads) {
    try {
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
        console.log(`🚮 Deleted local asset: ${localPath}`);
      }
    } catch (cleanErr) {
      console.error(`⚠️ Could not delete ${localPath}:`, cleanErr.message);
    }
  }

  console.log(`\n🎉 Workflow Complete! Replaced ${totalReplaced} URLs in codebase.`);
}

syncAssetsToCloud();