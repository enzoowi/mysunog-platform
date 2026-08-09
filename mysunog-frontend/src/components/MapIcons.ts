import L from 'leaflet';
import homeImg from '../assets/images/home.png';
import hydrantImg from '../assets/images/fire_hydrant.png';
import fireImg from '../assets/images/fire.png';

// Create a wrapper function to build circular icon markers with a shadow (for camera icon)
function createIcon(svgPath: string, bgClass: string, textClass: string) {
  const html = `
    <div style="
      background-color: white;
      border-radius: 50%;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2), 0 2px 4px -1px rgba(0,0,0,0.1);
      border: 2px solid white;
    " class="${bgClass}">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${textClass}">
        ${svgPath}
      </svg>
    </div>
    <!-- Pin triangle pointing down -->
    <div style="
      width: 0; 
      height: 0; 
      border-left: 6px solid transparent;
      border-right: 6px solid transparent;
      border-top: 8px solid white;
      position: absolute;
      bottom: -6px;
      left: 12px;
      filter: drop-shadow(0px 2px 1px rgba(0,0,0,0.2));
    "></div>
  `;
  return new L.DivIcon({
    html,
    className: 'custom-map-icon',
    iconSize: [36, 44],
    iconAnchor: [18, 44],
    popupAnchor: [0, -44],
  });
}

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
