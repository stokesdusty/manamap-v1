// Patches expo-camera@15.0.16's CameraViewLegacy.swift to remove references to
// EXBarCodeScannerInterface / EXBarCodeScannerProviderInterface, which were removed
// from ExpoModulesCore in SDK 52 but are still referenced by the legacy camera code.
// Also converts the asyncAfter trailing-closure form to the explicit execute: label
// to resolve an ambiguity introduced in newer Xcode.
//
// Uses exact string matching (not regex) to avoid structural corruption.

'use strict';

const fs = require('fs');
const path = require('path');

const SENTINEL = '// PATCHED-v2: barcode scanner refs removed for SDK 52 compatibility';

function findSwiftFile() {
  try {
    const pkg = require.resolve('expo-camera/package.json');
    return path.join(path.dirname(pkg), 'ios', 'Legacy', 'CameraViewLegacy.swift');
  } catch {
    const root = path.resolve(__dirname, '..', '..', '..');
    return path.join(root, 'node_modules', 'expo-camera', 'ios', 'Legacy', 'CameraViewLegacy.swift');
  }
}

const swiftFile = findSwiftFile();

if (!fs.existsSync(swiftFile)) {
  console.log('[patch-expo-camera] CameraViewLegacy.swift not found, skipping');
  process.exit(0);
}

let src = fs.readFileSync(swiftFile, 'utf8');

if (src.includes(SENTINEL)) {
  console.log('[patch-expo-camera] already patched (v2), skipping');
  process.exit(0);
}

// ── 1. Remove barCodeScanner property declaration ───────────────────────────
src = src.replace('  private var barCodeScanner: EXBarCodeScannerInterface?\n', '');

// ── 2. Replace isScanningBarCodes observer with empty didSet ────────────────
// Match the full didSet block regardless of body content
src = src.replace(
  /  var isScanningBarCodes = false \{\n    didSet \{[\s\S]*?\n    \}\n  \}/,
  '  var isScanningBarCodes = false {\n    didSet {}\n  }'
);

// ── 3. Remove barCodeScanner init lines ─────────────────────────────────────
src = src.replace('    barCodeScanner = createBarCodeScanner()\n', '');
src = src.replace('    barCodeScanner?.setPreviewLayer(previewLayer)\n', '');

// ── 4a. Remove barCodeScanner block inside asyncAfter ───────────────────────
src = src.replace(
  '        if let barCodeScanner = self.barCodeScanner {\n          barCodeScanner.maybeStartBarCodeScanning()\n        }\n',
  ''
);

// ── 4b. Convert asyncAfter trailing-closure to execute: form ────────────────
// Replace the opening
src = src.replace(
  'self.sessionQueue.asyncAfter(deadline: .now() + round(50 / 1_000_000)) {',
  'self.sessionQueue.asyncAfter(deadline: .now() + round(50 / 1_000_000), execute: {'
);
// Replace the closing — the asyncAfter block ends after onCameraReady()
src = src.replace(
  '        self.onCameraReady()\n      }\n    }\n  }',
  '        self.onCameraReady()\n      })\n    }\n  }'
);

// ── 5. Empty setBarCodeScannerSettings ──────────────────────────────────────
src = src.replace(
  /  func setBarCodeScannerSettings\(settings: \[String: Any\]\) \{[\s\S]*?\n  \}/,
  '  func setBarCodeScannerSettings(settings: [String: Any]) {}'
);

// ── 6. Remove barCodeScanner.stopBarCodeScanning() in stopSession() ─────────
src = src.replace(
  '      if let barCodeScanner = self.barCodeScanner {\n        barCodeScanner.stopBarCodeScanning()\n      }\n\n',
  ''
);

// ── 7. Remove entire createBarCodeScanner() function ────────────────────────
src = src.replace(
  /\n  private func createBarCodeScanner\(\) -> EXBarCodeScannerInterface\? \{[\s\S]*?\n  \}\n/,
  `\n\n  ${SENTINEL}\n`
);

// ── Verify the patch was effective ──────────────────────────────────────────
if (src.includes('EXBarCodeScannerInterface') || src.includes('EXBarCodeScannerProviderInterface')) {
  console.error('[patch-expo-camera] ERROR: patch incomplete — type refs still present');
  console.error('[patch-expo-camera] The original file format may have changed; manual patch required');
  process.exit(1);
}

fs.writeFileSync(swiftFile, src, 'utf8');
console.log('[patch-expo-camera] successfully patched CameraViewLegacy.swift');
