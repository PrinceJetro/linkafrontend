'use client'

import { CircleMarker, MapContainer, TileLayer, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

const COORDS: Record<string, [number, number]> = {
  NG: [9.08, 8.68],
  GH: [7.95, -1.02],
  KE: [0.02, 37.9],
  RW: [-1.94, 30.06],
  ZA: [-30.56, 22.94],
  EG: [26.82, 30.8],
  OTHER: [12.0, 22.0],
}

const NAMES: Record<string, string> = {
  NG: 'Nigeria', GH: 'Ghana', KE: 'Kenya', RW: 'Rwanda',
  ZA: 'South Africa', EG: 'Egypt', OTHER: 'Other',
}

export default function AfricaMap({ points }: { points: { country: string; count: number }[] }) {
  return (
    <MapContainer
      center={[8, 20]}
      zoom={3}
      scrollWheelZoom={false}
      style={{ height: 320, width: '100%', borderRadius: 12, zIndex: 0 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {points.map((p) => (
        <CircleMarker
          key={p.country}
          center={COORDS[p.country] ?? COORDS.OTHER}
          radius={8 + Math.min(p.count, 10) * 3}
          pathOptions={{ color: '#195c4b', fillColor: '#e87e41', fillOpacity: 0.7 }}
        >
          <Tooltip>
            {NAMES[p.country] ?? p.country}: {p.count} profile{p.count === 1 ? '' : 's'}
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  )
}
