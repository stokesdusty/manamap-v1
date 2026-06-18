module.exports = {
  dependencies: {
    // Excluded from autolinking because pnpm's Windows virtual-store paths
    // break the EAS Linux build. The useBleProximity hook loads this module
    // dynamically with a try/catch, so it degrades gracefully when not linked.
    'react-native-ble-plx': {
      platforms: { android: null, ios: null },
    },
  },
};
