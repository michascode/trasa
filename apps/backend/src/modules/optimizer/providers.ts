import type { LatLng } from './optimizer.types.js';

export interface DistanceTimeMatrix {
  distanceKm: number[][];
  durationMin: number[][];
  tollForbiddenViolations: Array<{ from: number; to: number; reason: string }>;
}

export interface RoutingProvider {
  name: string;
  getDistanceTimeMatrix(points: LatLng[], options: { forbidTollRoads: boolean; averageSpeedKmh: number }): Promise<DistanceTimeMatrix>;
}

export interface GeocodingProvider {
  name: string;
  geocode(address: string): Promise<LatLng | null>;
}

function haversineKm(a: LatLng, b: LatLng) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const value =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  return earthRadiusKm * (2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value)));
}

export class HaversineRoutingProvider implements RoutingProvider {
  name = 'haversine-routing';

  async getDistanceTimeMatrix(points: LatLng[], options: { forbidTollRoads: boolean; averageSpeedKmh: number }): Promise<DistanceTimeMatrix> {
    const speed = Math.max(5, options.averageSpeedKmh);
    const distanceKm = points.map((from) =>
      points.map((to) => {
        if (from === to) return 0;
        const roadFactor = 1.22;
        return Number((haversineKm(from, to) * roadFactor).toFixed(2));
      }),
    );

    const durationMin = distanceKm.map((row) =>
      row.map((distance) => Number(((distance / speed) * 60).toFixed(0))),
    );

    return {
      distanceKm,
      durationMin,
      tollForbiddenViolations: [],
    };
  }
}

export class StaticGeocodingProvider implements GeocodingProvider {
  name = 'static-geocoding';

  constructor(private readonly dictionary: Record<string, LatLng>) {}

  async geocode(address: string): Promise<LatLng | null> {
    return this.dictionary[address] ?? null;
  }
}
