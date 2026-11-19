// Windows only: moves the CMake/ninja build folder to a short path.
// Without it, codegen paths (e.g. react-native-gesture-handler) go past the
// 248-char directory limit that ninja 1.10 (bundled with CMake 3.22.1) can't exceed.
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// short-cmake-dir';
const SNIPPET = `
    ${MARKER}
    externalNativeBuild {
        cmake {
            buildStagingDirectory "C:/hc"
        }
    }
`;

module.exports = function withShortCmakeDir(config) {
  if (process.platform !== 'win32') return config;
  return withAppBuildGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes(MARKER)) {
      cfg.modResults.contents = cfg.modResults.contents.replace(
        /^android \{\n/m,
        (m) => m + SNIPPET,
      );
    }
    return cfg;
  });
};
