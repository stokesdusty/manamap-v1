/**
 * BLE proximity hook — foreground only.
 *
 * Strategy: while the Discover screen is open each device advertises a short
 * ManaMap service UUID and embeds its userId (truncated) in manufacturer data.
 * Peers scan for that UUID and record RSSI per userId, which is then used to
 * annotate / re-order the API-returned nearby list.
 *
 * iOS background-advertising limitation:
 *   CBPeripheralManager is suspended by iOS when the app moves to background.
 *   This means peers that background the app stop being detectable via BLE.
 *   The feature degrades gracefully: players that cannot be BLE-detected are
 *   still shown via the store-presence API; BLE only refines the ordering while
 *   both devices are in the foreground. There is no workaround for this iOS
 *   restriction — CoreBluetooth background modes only support specific use-cases
 *   (HID, ANCS, etc.) and cannot keep arbitrary peripheral advertisements alive.
 *
 * Android: advertising continues while the app process is alive, so background
 *   detection works until the OS kills the process.
 */

import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

// ManaMap BLE service UUID — all ManaMap peers advertise this
const MANAMAP_SERVICE_UUID = '4d414e41-4d41-5000-0000-000000000001';

// RSSI map: userId → most recent RSSI reading
export type RssiMap = Record<string, number>;

interface BleProximityResult {
  rssiMap: RssiMap;
  isScanning: boolean;
  isSupported: boolean;
}

// Graceful no-op when react-native-ble-plx native module is unavailable
// (Expo Go, simulator without BLE, or permission denied).
let BleManager: typeof import('react-native-ble-plx').BleManager | null = null;
let BleState: typeof import('react-native-ble-plx').State | null = null;

try {
  // Dynamic require so the app doesn't hard-crash if the native module is absent
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('react-native-ble-plx') as typeof import('react-native-ble-plx');
  BleManager = mod.BleManager;
  BleState = mod.State;
} catch {
  // Native module not linked — BLE is unavailable; everything degrades gracefully
}

export function useBleProximity(enabled: boolean): BleProximityResult {
  const [rssiMap, setRssiMap] = useState<RssiMap>({});
  const [isScanning, setIsScanning] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  const managerRef = useRef<InstanceType<typeof import('react-native-ble-plx').BleManager> | null>(null);

  useEffect(() => {
    if (!enabled || !BleManager || !BleState) return;

    // Web / unsupported platforms
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;

    const manager = new BleManager();
    managerRef.current = manager;

    let scanStarted = false;

    const sub = manager.onStateChange((state) => {
      if (state === BleState!.PoweredOn && !scanStarted) {
        scanStarted = true;
        setIsSupported(true);
        setIsScanning(true);

        manager.startDeviceScan(
          [MANAMAP_SERVICE_UUID],
          { allowDuplicates: true },
          (error, device) => {
            if (error) {
              // Permission denied or adapter error — degrade silently
              setIsScanning(false);
              return;
            }
            if (!device) return;

            // Extract userId from manufacturer data (first 36 chars = UUID)
            // Peers embed their userId in the local name field for simplicity
            const localName = device.localName ?? device.name ?? '';
            // Expected format: "MM:<userId-prefix-8-chars>"
            const match = localName.match(/^MM:([0-9a-f-]{8,36})/i);
            if (match && device.rssi != null) {
              const userIdPrefix = match[1];
              setRssiMap((prev) => ({ ...prev, [userIdPrefix]: device.rssi! }));
            }
          },
        );
      }
    }, true);

    return () => {
      sub.remove();
      if (scanStarted) {
        manager.stopDeviceScan();
      }
      manager.destroy();
      managerRef.current = null;
      setIsScanning(false);
      setRssiMap({});
    };
  }, [enabled]);

  return { rssiMap, isScanning, isSupported };
}

/**
 * Given the API-returned nearby list and a BLE rssiMap, returns the list
 * sorted so BLE-detected players (stronger signal first) appear at the top,
 * followed by non-detected players in their original order.
 */
export function sortByBleProximity<T extends { id: string }>(
  players: T[],
  rssiMap: RssiMap,
): T[] {
  // rssiMap keys may be 8-char prefixes of the full userId
  function getRssi(player: T): number | undefined {
    const prefix = player.id.replace(/-/g, '').substring(0, 8);
    return rssiMap[prefix] ?? rssiMap[player.id];
  }

  return [...players].sort((a, b) => {
    const ra = getRssi(a);
    const rb = getRssi(b);
    if (ra == null && rb == null) return 0;
    if (ra == null) return 1; // b detected, a not
    if (rb == null) return -1; // a detected, b not
    return rb - ra; // higher RSSI = closer
  });
}
