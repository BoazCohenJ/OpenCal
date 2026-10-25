// OpenCal ships as two variants of one codebase, chosen at build time with OPENCAL_VARIANT:
//
// - default: the preview build that updates over the air through EAS Update. It uses the
//   `.ota` application id from app.json so it can sit next to (or replace) the F-Droid app.
// - fdroid: the build F-Droid compiles from source. It has no remote code loading and owns the
//   clean `com.boazcohen.opencal` id, which must stay stable once published.
//
// Metro swaps expo-updates for a stub in the fdroid variant (see metro.config.js), and the
// F-Droid recipe uninstalls the package so it never reaches the APK.
module.exports = ({ config }) => {
  if (process.env.OPENCAL_VARIANT !== 'fdroid') return config;

  // eslint-disable-next-line no-unused-vars
  const { updates, runtimeVersion, owner, extra, ...rest } = config;
  return {
    ...rest,
    android: { ...config.android, package: 'com.boazcohen.opencal' },
  };
};
