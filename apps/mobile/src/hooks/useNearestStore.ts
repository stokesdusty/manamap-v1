import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import type { StorePin } from '@manamap/shared';
import { useStorePins } from './useNearby';

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function coordsToBbox(lat: number, lng: number, radiusDeg = 0.25): string {
  return `${lng - radiusDeg},${lat - radiusDeg},${lng + radiusDeg},${lat + radiusDeg}`;
}

export function useNearestStore() {
  const requested = useRef(false);
  const [bbox, setBbox] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const { data: pins = [] } = useStorePins(bbox);

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;

    void (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setPermissionDenied(true);
          setLoading(false);
          return;
        }
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserCoords({ lat, lng });
        setBbox(coordsToBbox(lat, lng));
      } catch {
        // Location unavailable (simulator, etc.) — silently give up
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  let store: StorePin | null = null;
  let distanceKm: number | null = null;

  if (userCoords && pins.length > 0) {
    let minDist = Infinity;
    for (const pin of pins) {
      const d = haversineKm(userCoords.lat, userCoords.lng, pin.lat, pin.lng);
      if (d < minDist) {
        minDist = d;
        store = pin;
      }
    }
    if (store) distanceKm = minDist;
  }

  return { store, distanceKm, loading, permissionDenied };
}
