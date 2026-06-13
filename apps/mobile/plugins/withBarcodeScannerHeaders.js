// Workaround: EXBarcodeScannerInterface and EXBarcodeScannerProviderInterface were
// removed from ExpoModulesCore in SDK 52, but expo-camera@15.x (CameraViewLegacy.swift)
// and expo-barcode-scanner@13.x still reference them.
//
// The ExpoModulesCore podspec uses ios/**/*.{h,m,mm,swift,cpp} as source_files, so
// any .h we drop into the ios/ExpoModulesCore directory gets included in the pod's
// umbrella header and becomes visible to Swift via `import ExpoModulesCore`.

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SCANNER_INTERFACE_H = `\
// Stub — removed from ExpoModulesCore in SDK 52; required by expo-camera@15.x legacy code.
#pragma once
#import <Foundation/Foundation.h>
#import <AVFoundation/AVFoundation.h>

@protocol EXBarCodeScannerInterface <NSObject>
- (void)setSession:(AVCaptureSession *)session;
- (void)setSessionQueue:(dispatch_queue_t)sessionQueue;
- (void)setOnBarCodeScanned:(void (^)(NSDictionary *))onBarCodeScanned;
- (void)setIsEnabled:(BOOL)enabled;
- (void)setSettings:(NSDictionary<NSString *, id> *)settings;
- (void)setPreviewLayer:(AVCaptureVideoPreviewLayer *)previewLayer;
- (void)maybeStartBarCodeScanning;
- (void)stopBarCodeScanning;
@end
`;

const PROVIDER_INTERFACE_H = `\
// Stub — removed from ExpoModulesCore in SDK 52; required by expo-barcode-scanner@13.x.
#pragma once
#import <Foundation/Foundation.h>
#import <ExpoModulesCore/EXBarcodeScannerInterface.h>

@protocol EXBarCodeScannerProviderInterface <NSObject>
- (id<EXBarCodeScannerInterface>)createBarCodeScanner;
@end
`;

module.exports = function withBarcodeScannerHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      let emodsCorePath;
      try {
        const pkg = require.resolve('expo-modules-core/package.json', {
          paths: [config.modRequest.projectRoot],
        });
        emodsCorePath = path.join(path.dirname(pkg), 'ios', 'ExpoModulesCore');
      } catch {
        // pnpm workspace fallback: package may be hoisted to repo root
        emodsCorePath = path.resolve(
          config.modRequest.projectRoot,
          '../../node_modules/expo-modules-core/ios/ExpoModulesCore',
        );
      }

      if (!fs.existsSync(emodsCorePath)) {
        console.warn(
          `[withBarcodeScannerHeaders] expo-modules-core iOS path not found: ${emodsCorePath}`,
        );
        return config;
      }

      for (const [name, content] of [
        ['EXBarcodeScannerInterface.h', SCANNER_INTERFACE_H],
        ['EXBarcodeScannerProviderInterface.h', PROVIDER_INTERFACE_H],
      ]) {
        const dest = path.join(emodsCorePath, name);
        if (!fs.existsSync(dest)) {
          fs.writeFileSync(dest, content, 'utf8');
        }
      }

      return config;
    },
  ]);
};
