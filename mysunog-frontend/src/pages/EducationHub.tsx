import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { BookOpen, ShieldCheck, Droplets, AlertTriangle, Home, BookMarked, Inbox, ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react';

type Content = {
  id: number;
  title: string;
  content: string;
  category: string;
  imageUrl?: string;
  createdAt: string;
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  general: <BookOpen className="w-5 h-5 text-blue-600" />,
  prevention: <ShieldCheck className="w-5 h-5 text-green-600" />,
  lpg: <Droplets className="w-5 h-5 text-orange-600" />,
  emergency: <AlertTriangle className="w-5 h-5 text-red-600" />,
  home_safety: <Home className="w-5 h-5 text-purple-600" />,
};

const CATEGORY_LABELS: Record<string, string> = {
  general: 'General',
  prevention: 'Fire Prevention',
  lpg: 'LPG Safety',
  emergency: 'Emergency Preparedness',
  home_safety: 'Home Safety',
};

const BACKEND_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3000`;

export default function EducationHub() {
  const [contents, setContents] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    async function fetchBanner() {
      try {
        const res = await api.get('/site-images');
        const banner = res.data.find((img: any) => img.key === 'education_banner');
        if (banner?.imageUrl) setBannerUrl(banner.imageUrl?.startsWith('http') ? banner.imageUrl : `${BACKEND_URL}${banner.imageUrl}`);
      } catch {
        console.error('Failed to load education banner');
      }
    }
    fetchBanner();
  }, []);

  useEffect(() => {
    const params = selectedCategory ? `?category=${selectedCategory}` : '';
    api.get(`/education${params}`)
      .then((res) => setContents(res.data))
      .catch((err) => { console.error(err); alert('Failed to load education content.'); })
      .finally(() => setLoading(false));
  }, [selectedCategory]);

  useEffect(() => {
    setCurrentIndex(0);
    setProgress(0);
  }, [selectedCategory, contents.length]);

  // Reset progress when index changes manually or automatically
  useEffect(() => {
    setProgress(0);
  }, [currentIndex]);

  // Auto-advance timer (15 seconds)
  useEffect(() => {
    if (contents.length <= 1) return;

    const intervalTime = 150; // ms
    const totalTime = 15000; // 15s
    const step = (intervalTime / totalTime) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev + step >= 100) {
          setCurrentIndex((curr) => (curr + 1) % contents.length);
          return 0;
        }
        return prev + step;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [contents.length, currentIndex]);

  const handlePrev = () => setCurrentIndex((prev) => (prev === 0 ? contents.length - 1 : prev - 1));
  const handleNext = () => setCurrentIndex((prev) => (prev + 1) % contents.length);

  return (
    <div className="w-full">
      {bannerUrl && (
        <div className="w-full h-48 md:h-64 mb-8 rounded-2xl overflow-hidden relative shadow-md">
          <div className="absolute inset-0 bg-black/40 z-10"></div>
          <img src={bannerUrl} alt="Education Hub Banner" className="w-full h-full object-cover" />
          <div className="absolute inset-0 z-20 flex flex-col justify-center items-center text-white text-center p-4">
            <BookMarked className="w-12 h-12 mb-2 drop-shadow-md" />
            <h2 className="text-3xl md:text-4xl font-extrabold drop-shadow-md mb-2">Fire Safety Education</h2>
            <p className="text-sm md:text-base font-medium drop-shadow-md">Learn how to stay safe and prevent fires in your community.</p>
          </div>
        </div>
      )}
      
      <div className="max-w-6xl mx-auto px-4 md:px-0">
        {!bannerUrl && (
          <div className="mb-8">
            <div className="inline-flex items-center gap-1.5 bg-blue-100 text-blue-700 text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-3">
              <BookMarked className="w-3.5 h-3.5" /> Learning Center
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight">Fire Safety Education Hub</h2>
            <p className="text-gray-500 mt-2 text-lg">Learn how to stay safe and prevent fires in your community.</p>
          </div>
        )}

        {/* Enhanced Category Pills */}
        <div className="flex flex-wrap gap-2 mb-8 justify-center md:justify-start">
          <button onClick={() => setSelectedCategory('')}
            className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-300 shadow-sm hover:shadow-md ${!selectedCategory ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white hover:scale-105' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            All Topics
          </button>
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <button key={key} onClick={() => setSelectedCategory(key)}
              className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-300 flex items-center gap-2 shadow-sm hover:shadow-md ${selectedCategory === key ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white [&>svg]:text-white hover:scale-105' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {CATEGORY_ICONS[key]} {label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="w-full h-[500px] bg-gray-100 rounded-3xl animate-pulse"></div>
        )}

        {!loading && contents.length === 0 && (
          <div className="bg-white border border-gray-100 rounded-3xl p-12 text-center flex flex-col items-center justify-center shadow-sm">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <Inbox className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">No Content Yet</h3>
            <p className="text-gray-500">Check back later for educational resources.</p>
          </div>
        )}

        {!loading && contents.length > 0 && (
          <>
            {contents.length > 1 && (
              <div className="w-full max-w-sm md:max-w-md mx-auto mb-2 h-1 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                <div 
                  className="h-full bg-gradient-to-r from-orange-400 to-red-500 transition-all duration-150 ease-linear"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            )}
            <div className="relative w-full h-[600px] flex items-center justify-center overflow-hidden py-4">
            
            {/* Left Navigation Arrow */}
            <button 
              onClick={handlePrev}
              className="absolute left-0 md:left-4 z-30 p-3 rounded-full bg-white/90 backdrop-blur shadow-lg border border-gray-100 transition-all opacity-100 hover:bg-gray-50 hover:scale-105"
            >
              <ChevronLeft className="w-6 h-6 text-gray-700" />
            </button>

            {contents.map((c, index) => {
              const offset = index - currentIndex;
              
              let translateX = '0%';
              let scale = 'scale-100';
              let opacity = 'opacity-100';
              let blur = 'blur-none';
              let zIndex = 20;
              let pointerEvents = 'pointer-events-auto';

              if (offset === 0) {
                translateX = '0%';
              } else if (offset === -1) {
                translateX = '-85%';
                scale = 'scale-[0.85]';
                opacity = 'opacity-40';
                blur = 'blur-[2px]';
                zIndex = 10;
                pointerEvents = 'pointer-events-auto cursor-pointer';
              } else if (offset === 1) {
                translateX = '85%';
                scale = 'scale-[0.85]';
                opacity = 'opacity-40';
                blur = 'blur-[2px]';
                zIndex = 10;
                pointerEvents = 'pointer-events-auto cursor-pointer';
              } else {
                translateX = offset > 0 ? '150%' : '-150%';
                scale = 'scale-75';
                opacity = 'opacity-0';
                blur = 'blur-md';
                zIndex = 0;
                pointerEvents = 'pointer-events-none';
              }

              // Apply md: overrides purely in className or adjust here
              // Since tailwind handles media queries natively but we are using inline style for translateX,
              // we can use CSS variables or just let React handle a standard value.
              // We'll stick to fixed percentage for simplicity, 85% works well on both.

              return (
                <div 
                  key={c.id}
                  className={`absolute w-full max-w-sm md:max-w-md h-full transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] ${scale} ${opacity} ${blur} ${pointerEvents}`}
                  style={{ transform: `translateX(${translateX})`, zIndex }}
                  onClick={() => {
                     if (offset === -1) handlePrev();
                     else if (offset === 1) handleNext();
                  }}
                >
                  <div className={`w-full h-full border-0 rounded-[2rem] overflow-hidden bg-white flex flex-col transition-all duration-500 ${offset === 0 ? 'shadow-[0_20px_50px_rgba(0,0,0,0.15)] ring-1 ring-gray-900/5' : 'shadow-lg'}`}>
                    {c.imageUrl ? (
                      <div 
                        className={`w-full ${(!c.title && !c.content) ? 'h-full flex-1' : 'h-64 md:h-72 shrink-0'} overflow-hidden bg-gray-50 flex items-center justify-center relative group cursor-zoom-in`}
                        onClick={(e) => { e.stopPropagation(); setLightboxImage(c.imageUrl?.startsWith('http') ? c.imageUrl : `${BACKEND_URL}${c.imageUrl}`); }}
                      >
                        <img src={c.imageUrl?.startsWith('http') ? c.imageUrl : `${BACKEND_URL}${c.imageUrl}`} alt={c.title} className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-105" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-all duration-300 flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/70 backdrop-blur-md rounded-full p-3 shadow-2xl border border-white/50">
                            <ZoomIn className="w-6 h-6 text-gray-800" />
                          </div>
                        </div>

                      </div>
                    ) : (
                       <div className="w-full h-48 shrink-0 bg-gradient-to-br from-orange-100 to-red-50 flex items-center justify-center p-6 text-center border-b border-gray-100">
                         <div className="flex flex-col items-center gap-3">
                           <div className="p-4 bg-white rounded-full shadow-sm">{CATEGORY_ICONS[c.category] || <BookOpen className="w-8 h-8 text-blue-600" />}</div>
                           <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{CATEGORY_LABELS[c.category] || c.category}</span>
                         </div>
                       </div>
                    )}
                    <div className={`flex flex-col flex-1 overflow-y-auto custom-scrollbar bg-white ${(!c.title && !c.content) ? 'p-4 border-t border-gray-100 shrink-0 flex-none' : 'p-6 md:p-8'}`}>
                      {c.imageUrl && (
                        <div className={`flex items-center gap-1.5 ${(!c.title && !c.content) ? 'justify-center' : 'mb-3'}`}>
                          <span className="text-gray-500 scale-90">{CATEGORY_ICONS[c.category] || <BookOpen className="w-5 h-5" />}</span>
                          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">{CATEGORY_LABELS[c.category] || c.category}</span>
                        </div>
                      )}
                      {c.title && <h3 className="font-extrabold text-gray-900 text-xl md:text-2xl mb-4 leading-tight shrink-0">{c.title}</h3>}
                      {c.content && <div className="text-gray-600 text-sm md:text-base leading-relaxed whitespace-pre-wrap">
                        {c.content}
                      </div>}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Right Navigation Arrow */}
            <button 
              onClick={handleNext}
              className="absolute right-0 md:right-4 z-30 p-3 rounded-full bg-white/90 backdrop-blur shadow-lg border border-gray-100 transition-all opacity-100 hover:bg-gray-50 hover:scale-105"
            >
              <ChevronRight className="w-6 h-6 text-gray-700" />
            </button>
            
          </div>
          </>
        )}
      </div>
      
      {/* Optional Custom Scrollbar Styles */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent; 
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #cbd5e1; 
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: #94a3b8; 
        }
      `}</style>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-5xl w-full max-h-[90vh] flex items-center justify-center">
            <button
              className="absolute -top-4 -right-4 z-10 bg-white rounded-full p-2 shadow-xl hover:bg-gray-100 transition"
              onClick={() => setLightboxImage(null)}
            >
              <X className="w-5 h-5 text-gray-700" />
            </button>
            <img
              src={lightboxImage}
              alt="Full view"
              className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
