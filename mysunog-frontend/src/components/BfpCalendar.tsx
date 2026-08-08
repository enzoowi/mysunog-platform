import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, MapPin, X } from 'lucide-react';
interface BfpEvent {
  id: string;
  title: string;
  date: Date;
  time?: string;
  location?: string;
  type: 'training' | 'inspection' | 'community' | 'drill';
}
import { api } from '../services/api';

const TYPE_COLORS = {
  training: 'bg-blue-100 text-blue-700 border-blue-200',
  inspection: 'bg-amber-100 text-amber-700 border-amber-200',
  community: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  drill: 'bg-red-100 text-red-700 border-red-200',
};

export default function BfpCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<BfpEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<BfpEvent | null>(null);

  useEffect(() => {
    async function fetchEvents() {
      try {
        const res = await api.get('/calendar-events');
        // Parse date strings to Date objects
        const formattedEvents = res.data.map((e: any) => ({
          ...e,
          date: new Date(e.date)
        }));
        setEvents(formattedEvents);
      } catch (err) {
        console.error('Failed to load events', err);
      }
    }
    fetchEvents();
  }, []);

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // Group events by day
  const eventsByDay: { [key: number]: BfpEvent[] } = {};
  events.forEach(event => {
    if (event.date.getMonth() === currentDate.getMonth() && event.date.getFullYear() === currentDate.getFullYear()) {
      const day = event.date.getDate();
      if (!eventsByDay[day]) {
        eventsByDay[day] = [];
      }
      eventsByDay[day].push(event);
    }
  });

  // Get upcoming events (next 3)
  const upcomingEvents = [...events]
    .filter(e => e.date.getTime() >= new Date(new Date().setHours(0, 0, 0, 0)).getTime())
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 3);

  // Fallback to all events sorted if no upcoming ones in this month
  const displayEvents = upcomingEvents.length > 0 ? upcomingEvents : events.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 3);


  return (
    <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden flex flex-col lg:flex-row">
      
      {/* Sidebar: Upcoming Events */}
      <div className="lg:w-1/3 bg-gradient-to-br from-orange-600 to-red-700 p-8 flex flex-col justify-between relative overflow-hidden">
        {/* Subtle background decoration */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm shadow-inner">
              <CalendarIcon className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-white tracking-tight">BFP Calendar</h3>
          </div>
          <p className="text-red-50 text-sm mb-8 leading-relaxed">
            Stay updated with the latest events, trainings, and community activities organized by BFP Malvar.
          </p>

          <h4 className="text-xs font-bold text-red-200 uppercase tracking-widest mb-4">Upcoming Events</h4>
          
          <div className="flex flex-col gap-4">
            {displayEvents.map((event) => (
              <div 
                key={event.id} 
                onClick={() => setSelectedEvent(event)}
                className="bg-white/10 border border-white/20 backdrop-blur-sm rounded-2xl p-4 hover:bg-white/20 hover:border-white/40 transition-all shadow-sm cursor-pointer"
              >
                <div className="flex items-start justify-between mb-2">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${TYPE_COLORS[event.type].replace('bg-', 'bg-white text-').replace('text-', 'text-').replace('border-', 'border-white border-')}`}>
                    {event.type}
                  </span>
                  <span className="text-white text-xs font-bold bg-white/20 px-2.5 py-1 rounded-lg">
                    {monthNames[event.date.getMonth()].substring(0, 3)} {event.date.getDate()}
                  </span>
                </div>
                <h5 className="font-bold text-white text-sm mb-2 leading-tight">{event.title}</h5>
                {event.time && (
                  <div className="flex items-center gap-2 text-red-100 text-xs mt-1.5 font-medium">
                    <Clock className="w-3.5 h-3.5 flex-shrink-0 opacity-80" />
                    <span>{event.time}</span>
                  </div>
                )}
                {event.location && (
                  <div className="flex items-center gap-2 text-red-100 text-xs mt-1.5 font-medium">
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0 opacity-80" />
                    <span className="truncate">{event.location}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        
        <div className="mt-8 pt-6 border-t border-white/20 text-xs text-red-100/80 font-medium relative z-10">
          * Schedule may change without prior notice. Contact us for verification.
        </div>
      </div>

      {/* Main Calendar View */}
      <div className="lg:w-2/3 p-6 md:p-8">
        
        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-extrabold text-slate-800">
            {monthNames[currentDate.getMonth()]} <span className="text-slate-400 font-medium">{currentDate.getFullYear()}</span>
          </h2>
          <div className="flex gap-2">
            <button onClick={prevMonth} className="p-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 transition-all">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={nextMonth} className="p-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 transition-all">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Days of Week */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-xs font-bold text-slate-400 uppercase tracking-widest py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-2 lg:gap-3">
          {blanks.map((_, i) => (
            <div key={`blank-${i}`} className="min-h-[80px] lg:min-h-[100px] rounded-xl bg-slate-50/50"></div>
          ))}
          {days.map(day => {
            const isToday = 
              day === new Date().getDate() && 
              currentDate.getMonth() === new Date().getMonth() && 
              currentDate.getFullYear() === new Date().getFullYear();
            
            const dayEvents = eventsByDay[day] || [];

            return (
              <div 
                key={day} 
                className={`min-h-[80px] lg:min-h-[100px] p-2 rounded-xl border transition-all ${
                  isToday 
                    ? 'border-orange-500 bg-orange-50/30' 
                    : 'border-gray-100 bg-white hover:border-orange-200 hover:shadow-sm'
                } flex flex-col group`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-lg ${
                    isToday ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-600 group-hover:text-orange-600 group-hover:bg-orange-50'
                  }`}>
                    {day}
                  </span>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-1.5 hide-scrollbar mt-1">
                  {dayEvents.map(event => (
                    <div 
                      key={event.id}
                      onClick={(e) => { e.stopPropagation(); setSelectedEvent(event); }}
                      className={`text-[10px] md:text-xs font-medium px-1.5 py-1 rounded border leading-tight line-clamp-2 cursor-pointer hover:opacity-80 transition-opacity ${TYPE_COLORS[event.type]}`}
                      title={event.title}
                    >
                      {event.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-8 flex flex-wrap gap-4 pt-6 border-t border-gray-100">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-xs text-slate-500 font-medium">Training</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
            <span className="text-xs text-slate-500 font-medium">Inspection</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
            <span className="text-xs text-slate-500 font-medium">Community</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-xs text-slate-500 font-medium">Drill</span>
          </div>
        </div>

      </div>

      {/* Event Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className={`p-6 text-white ${
              selectedEvent.type === 'training' ? 'bg-blue-600' :
              selectedEvent.type === 'inspection' ? 'bg-amber-500' :
              selectedEvent.type === 'community' ? 'bg-emerald-600' :
              'bg-red-600'
            }`}>
              <div className="flex justify-between items-start mb-4">
                <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider backdrop-blur-md">
                  {selectedEvent.type}
                </span>
                <button onClick={() => setSelectedEvent(null)} className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full transition-colors backdrop-blur-md">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <h3 className="text-xl font-bold leading-tight mb-2">{selectedEvent.title}</h3>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 text-slate-700">
                <div className="p-2.5 bg-slate-100 rounded-xl text-slate-500">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Date</p>
                  <p className="font-semibold text-slate-800">
                    {selectedEvent.date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
              </div>
              
              {selectedEvent.time && (
                <div className="flex items-center gap-3 text-slate-700">
                  <div className="p-2.5 bg-slate-100 rounded-xl text-slate-500">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Time</p>
                    <p className="font-semibold text-slate-800">{selectedEvent.time}</p>
                  </div>
                </div>
              )}
              
              {selectedEvent.location && (
                <div className="flex items-center gap-3 text-slate-700">
                  <div className="p-2.5 bg-slate-100 rounded-xl text-slate-500">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Location</p>
                    <p className="font-semibold text-slate-800">{selectedEvent.location}</p>
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setSelectedEvent(null)}
                className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
