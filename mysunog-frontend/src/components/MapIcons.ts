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

// Custom PNG Icons
export const stationIcon = new L.Icon({
    iconUrl: homeImg,
    shadowUrl: '',
    iconSize: [40, 40] as L.PointTuple,
    iconAnchor: [20, 40] as L.PointTuple,
    popupAnchor: [0, -40] as L.PointTuple,
});

export const hydrantIcon = new L.Icon({
    iconUrl: hydrantImg,
    shadowUrl: '',
    iconSize: [40, 40] as L.PointTuple,
    iconAnchor: [20, 40] as L.PointTuple,
    popupAnchor: [0, -40] as L.PointTuple,
});

export const incidentIcon = new L.Icon({
    iconUrl: fireImg,
    shadowUrl: '',
    iconSize: [40, 40] as L.PointTuple,
    iconAnchor: [20, 40] as L.PointTuple,
    popupAnchor: [0, -40] as L.PointTuple,
});

export const getIncidentIcon = (_severity: string) => {
    // We only have one fire.png, so we return it for all severities
    return incidentIcon;
};

// Purple Camera Icon (SVG)
const cameraPath = `
  <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
  <circle cx="12" cy="13" r="3" />
`;

export const cameraIcon = createIcon(cameraPath, 'bg-purple-500', 'text-white');
