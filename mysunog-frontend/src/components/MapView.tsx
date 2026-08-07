import { MapContainer, LayersControl, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

export default function MapView() {
  return (
    <div style={{ height: '500px', width: '100%' }}>
      <MapContainer
        center={[14.1008, 121.0583]} // example coordinates
        zoom={13}
        style={{ height: '100%', width: '100%' }}
      >
        <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="Map">
              <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Satellite">
              <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="&copy; Esri" />
            </LayersControl.BaseLayer>
          </LayersControl>
      </MapContainer>
    </div>
  );
}