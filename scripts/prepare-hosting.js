const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.join(__dirname, '..');
const hostingDir = path.join(rootDir, 'hosting');
const adminDir = path.join(rootDir, 'admin');

console.log('--- Preparing Firebase Hosting Bundle ---');

try {
  // 1. Recreate hosting directory structure
  if (!fs.existsSync(hostingDir)) {
    fs.mkdirSync(hostingDir, { recursive: true });
  }

  // 2. Copy landing page index.html
  const landingHtmlSrc = path.join(rootDir, 'index.html');
  const landingHtmlDst = path.join(hostingDir, 'index.html');
  if (fs.existsSync(landingHtmlSrc)) {
    fs.copyFileSync(landingHtmlSrc, landingHtmlDst);
    console.log('✓ Copied landing page: index.html');
  }

  // 3. Copy landing page style.css
  const landingCssSrc = path.join(rootDir, 'landing-style.css');
  const landingCssDst = path.join(hostingDir, 'landing-style.css');
  if (fs.existsSync(landingCssSrc)) {
    fs.copyFileSync(landingCssSrc, landingCssDst);
    console.log('✓ Copied landing styles: landing-style.css');
  }

  // 4. Copy admin portal files
  const hostingAdminDir = path.join(hostingDir, 'admin');
  fs.mkdirSync(hostingAdminDir, { recursive: true });

  const adminFiles = ['index.html', 'app.js', 'style.css', 'payment-success.html', 'payment-failed.html'];
  adminFiles.forEach(file => {
    const src = path.join(adminDir, file);
    const dst = path.join(hostingAdminDir, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dst);
      console.log(`✓ Copied admin asset: admin/${file}`);
    }
  });

  // Also copy payment pages to the root of hosting for direct callbacks
  const rootPaymentPages = ['payment-success.html', 'payment-failed.html'];
  rootPaymentPages.forEach(file => {
    const src = path.join(adminDir, file);
    const dst = path.join(hostingDir, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dst);
      console.log(`✓ Copied payment page to root: ${file}`);
    }
  });

  // 5. Check if android APK exists in assets, and copy it
  const apkSrc = path.join(rootDir, 'assets/utem-ride.apk');
  const apkDstDir = path.join(hostingDir, 'assets');
  const apkDst = path.join(apkDstDir, 'utem-ride.apk');

  if (fs.existsSync(apkSrc)) {
    fs.mkdirSync(apkDstDir, { recursive: true });
    console.log('Copying android APK (175MB)... This might take a few seconds.');
    fs.copyFileSync(apkSrc, apkDst);
    console.log('✓ Copied android APK to hosting bundle.');
  } else {
    console.log('! Note: assets/utem-ride.apk was not found. Download link on landing page will fallback or fail unless uploaded.');
  }

  // 6. Generate configuration env-config.js files
  console.log('Generating Firebase environment configuration files...');
  execSync('node scripts/generate-admin-config.js', { stdio: 'inherit' });

  console.log('-------------------------------------------');
  console.log('🎉 Web bundle is successfully prepared at /hosting!');
  console.log('You can now deploy by running:');
  console.log('  npx firebase deploy --only hosting');
  console.log('-------------------------------------------');

} catch (error) {
  console.error('❌ Failed to prepare hosting bundle:', error.message);
  process.exit(1);
}
