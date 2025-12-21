const path = require('node:path');

let notarize;
try {
  // Optional dependency: only required for macOS signing/notarization.
  notarize = require('@electron/notarize').notarize;
} catch {
  notarize = null;
}

exports.default = async function notarizeApp(context) {
  const { electronPlatformName, appOutDir, packager } = context;
  if (electronPlatformName !== 'darwin') return;

  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;

  if (!notarize) {
    console.log('[notarize] @electron/notarize not installed; skip notarization.');
    return;
  }

  if (!appleId || !appleIdPassword || !teamId) {
    console.log('[notarize] Missing APPLE_ID/APPLE_APP_SPECIFIC_PASSWORD/APPLE_TEAM_ID; skip notarization.');
    return;
  }

  const appName = packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  console.log('[notarize] notarizing', appPath);
  await notarize({
    appBundleId: packager.appInfo.id,
    appPath,
    appleId,
    appleIdPassword,
    teamId,
  });
  console.log('[notarize] done');
};
