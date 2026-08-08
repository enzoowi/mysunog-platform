import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, MapPin } from 'lucide-react';
interface BfpEvent {
  id: string;
  title: string;
  date: Date;
  time?: string;
  location?: string;
  type: 'training' | 'inspection' | 'community' | 'drill';
}

const getMockEvents = (currentDate: Date): BfpEvent[] => {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  return [
    {
      id: '1',
      title: 'Barangay Fire Drill',
      date: new Date(year, month, 5),
      time: '08:00 AM - 12:00 PM',
      location: 'Brgy. Poblacion Covered Court',
      type: 'drill',
    },
    {
      id: '2',
      title: 'Commercial Establishments Inspection',
      date: new Date(year, month, 12),
      time: '09:00 AM - 04:00 PM',
      location: 'Malvar Commercial Center',
      type: 'inspection',
    },
    {
      id: '3',
      title: 'Fire Safety Seminar for Schools',
      date: new Date(year, month, 18),
      time: '01:00 PM - 03:00 PM',
      location: 'Malvar National High School',
      type: 'community',
    },
    {
      id: '4',
      title: 'Volunteer Fire Brigade Training',
      date: new Date(year, month, 25),
      time: '07:00 AM - 05:00 PM',
      location: 'BFP Malvar Station',
      type: 'training',
    },
  ];
};

const TYPE_COLORS = {
  training: 'bg-blue-100 text-blue-700 border-blue-200',
  inspection: 'bg-amber-100 text-amber-700 border-amber-200',
  community: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  drill: 'bg-red-100 text-red-700 border-red-200',
};

export default function BfpCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const events = getMockEvents(currentDate);

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
      <div className="lg:w-1/3 bg-slate-900 p-8 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-orange-500/20 rounded-xl">
              <CalendarIcon className="w-6 h-6 text-orange-400" />
            </div>
            <h3 className="text-2xl font-bold text-white">BFP Calendar</h3>
          </div>
          <p className="text-slate-400 text-sm mb-8 leading-relaxed">
            Stay updated with the latest events, trainings, and community activities organized by BFP Malvar.
          </p>

          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Upcoming Events</h4>
          
          <div className="flex flex-col gap-4">
            {displayEvents.map((event) => (
              <div key={event.id} className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 hover:border-orange-500/50 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${TYPE_COLORS[event.type].replace('bg-', 'bg-opacity-20 bg-').replace('border-', 'border-opacity-20 border-')}`}>
                    {event.type}
                  </span>
                  <span className="text-orange-400 text-xs font-bold bg-orange-400/10 px-2 py-1 rounded-lg">
                    {monthNames[event.date.getMonth()].substring(0, 3)} {event.date.getDate()}
                  </span>
                </div>
                <h5 className="font-bold text-white text-sm mb-2">{event.title}</h5>
                {event.time && (
                  <div className="flex items-center gap-2 text-slate-400 text-xs mt-1">
                    <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{event.time}</span>
                  </div>
                )}
                {event.location && (
                  <div className="flex items-center gap-2 text-slate-400 text-xs mt-1">
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{event.location}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        
        <div className="mt-8 pt-6 border-t border-slate-800 text-xs text-slate-500">
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
                      className={`text-[10px] md:text-xs font-medium px-1.5 py-1 rounded border leading-tight line-clamp-2 ${TYPE_COLORS[event.type]}`}
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
    </div>
  );
}
