import L from 'leaflet';

// Create a wrapper function to build circular icon markers with a shadow
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

// Blue Hydrant Icon (Droplet / Cylinder combination) - using lucide-like path or custom
// We will use a standard Fire Hydrant SVG path
const hydrantPath = `
  <path d="M12 22v-4" />
  <path d="M12 18H8v-4h8v4h-4z" />
  <path d="M8 14V8a4 4 0 0 1 8 0v6" />
  <path d="M6 10h2" />
  <path d="M16 10h2" />
  <path d="M12 8v-2" />
  <path d="M10 6h4" />
`;

// Green House Icon (BFP Station)
const housePath = `
  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  <polyline points="9 22 9 12 15 12 15 22" />
`;

// Orange/Red Fire Icon (Incidents)
const firePath = `
  <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
`;

// Purple Camera Icon
const cameraPath = `
  <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
  <circle cx="12" cy="13" r="3" />
`;

export const hydrantIcon = createIcon(hydrantPath, 'bg-blue-600', 'text-white');
export const stationIcon = createIcon(housePath, 'bg-green-600', 'text-white');
export const incidentIcon = createIcon(firePath, 'bg-red-500', 'text-white');
export const cameraIcon = createIcon(cameraPath, 'bg-purple-500', 'text-white');

// We also have some generic icons used in the maps. Let's provide a generic function.
export const getIncidentIcon = (severity: string) => {
  const bg = severity === 'High' || severity === 'Critical' ? 'bg-red-600' : 'bg-orange-500';
  return createIcon(firePath, bg, 'text-white');
};
