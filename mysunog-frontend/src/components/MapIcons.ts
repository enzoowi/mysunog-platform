import L from 'leaflet';
import homeImg from '../assets/images/home.png';
import hydrantImg from '../assets/images/fire_hydrant.png';
import fireImg from '../assets/images/fire.png';


// Helper to create a DivIcon from a PNG image URL
function createPngIcon(imgUrl: string, size: number = 36) {
  return new L.DivIcon({
    html: `<img src="${imgUrl}" style="width:${size}px;height:${size}px;display:block;" />`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
}

// Custom PNG Icons
export const stationIcon = createPngIcon(homeImg, 40);
export const hydrantIcon = createPngIcon(hydrantImg, 40);
export const incidentIcon = createPngIcon(fireImg, 40);

export const getIncidentIcon = (_severity: string) => {
    return incidentIcon;
};

// Purple Camera Icon (Standard Pin)
export const cameraIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-violet.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});
