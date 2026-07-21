import React, { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Load marker icon images from a CDN instead of bundling them — avoids
// the well-known Leaflet + bundler "broken marker icon" path issue.
const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Recenters the map whenever lat/lng change from *outside* (e.g. a new
// address was picked) without fighting the user while they're dragging.
function Recenter({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);
  return null;
}

export default function MapPicker({ lat, lng, onMove, height = 220 }) {
  const markerRef = useRef(null);

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker) {
          const pos = marker.getLatLng();
          onMove({ lat: pos.lat, lng: pos.lng });
        }
      },
    }),
    [onMove]
  );

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return (
    <div style={{ height, borderRadius: 14, overflow: "hidden", border: "1.5px solid #182620" }}>
      <MapContainer
        center={[lat, lng]}
        zoom={17}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker
          draggable
          eventHandlers={eventHandlers}
          position={[lat, lng]}
          icon={markerIcon}
          ref={markerRef}
        />
        <Recenter lat={lat} lng={lng} />
      </MapContainer>
    </div>
  );
}
