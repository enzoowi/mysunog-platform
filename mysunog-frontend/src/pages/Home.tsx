import { useEffect, useState } from 'react';
import { api } from '../services/api';
import Alerts from './Alerts';
import EducationHub from './EducationHub';
import EmergencyHotlines from './EmergencyHotlines';
import PublicCommunityMap from '../components/PublicCommunityMap';
import bfpStationImg from '../assets/images/bfpstation.jpg';
import bfpLogo from '../assets/images/bfp-logo.jpg';
import malvarLogo from '../assets/images/malvar-logo.png';

const BACKEND_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3000`;

export default function Home() {
  const [heroImage, setHeroImage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHero() {
      try {
        const res = await api.get('/site-images');
        const hero = res.data.find((img: any) => img.key === 'home_hero');
        if (hero?.imageUrl) setHeroImage(hero.imageUrl?.startsWith('http') ? hero.imageUrl : `${BACKEND_URL}${hero.imageUrl}`);
      } catch {
        console.error('Failed to load hero banner');
      }
    }
    fetchHero();
  }, []);

  return (
    <div className="bg-gray-50 flex flex-col min-h-screen">
      {/* Hero Section */}
      <section 
        className="bg-slate-900 text-white relative py-12 px-6 md:px-12 overflow-hidden"
        style={{ 
          backgroundImage: `url(${heroImage || bfpStationImg})`, 
          backgroundSize: 'cover', 
          backgroundPosition: 'center',
          backgroundBlendMode: 'overlay',
          backgroundColor: 'rgba(15, 23, 42, 0.8)'
        }}
      >
        {/* Abstract background graphics to mimic government agency feel */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-orange-400 via-red-900 to-transparent"></div>
        <div className="max-w-7xl mx-auto relative z-10 flex flex-col items-center text-center">
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 mb-2">
              <img src={malvarLogo} alt="Malvar Logo" className="w-20 h-20 md:w-32 md:h-32 object-contain" />
              <div className="flex flex-col items-center justify-center">
                <p className="text-sm md:text-lg font-semibold tracking-widest text-slate-200 mb-1">REPUBLIC OF THE PHILIPPINES</p>
                <h1 className="text-3xl md:text-5xl font-extrabold my-2 tracking-tight shadow-sm text-white">BUREAU OF FIRE PROTECTION</h1>
                <p className="text-lg md:text-2xl font-bold tracking-widest text-orange-400 mt-1">MUNICIPALITY OF MALVAR</p>
              </div>
              <img src={bfpLogo} alt="BFP Logo" className="w-20 h-20 md:w-32 md:h-32 object-contain rounded-full" />
            </div>
            <div className="mt-8 flex gap-4">
                <a href="#hotlines" className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-bold shadow-lg transition-all duration-200">
                    Emergency Hotlines
                </a>
                <a href="#alerts" className="bg-white text-slate-800 hover:bg-gray-100 px-6 py-3 rounded-lg font-bold shadow-lg transition-all duration-200">
                    Latest Alerts
                </a>
            </div>
        </div>
      </section>

      <div className="flex-1 w-full flex flex-col items-center">
          {/* Alerts Section */}
          <section id="alerts" className="w-full py-16 scroll-mt-16 bg-white border-b border-gray-200">
              <div className="max-w-7xl mx-auto px-4 md:px-8">
                  <Alerts />
              </div>
          </section>

          {/* About Us Section */}
          <section id="about" className="w-full py-20 scroll-mt-16 bg-slate-50 border-b border-gray-200">
              <div className="max-w-7xl mx-auto px-4 md:px-8">
                  <div className="text-center mb-14">
                      <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight">About BFP Malvar</h2>
                      <div className="w-24 h-1.5 bg-orange-600 mx-auto mt-5 rounded-full"></div>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
                      {/* Profile & Location */}
                      <div className="lg:col-span-5 bg-white p-8 md:p-10 rounded-3xl border border-gray-200 shadow-sm flex flex-col justify-center relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-bl-[100px] -z-0"></div>
                          <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3 relative z-10">
                              <span className="p-2.5 bg-orange-100 text-orange-600 rounded-xl">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                              </span>
                              Profile & Location
                          </h3>
                          <p className="text-gray-600 leading-relaxed relative z-10 text-[15px]">
                              The Bureau of Fire Protection (BFP) Malvar Fire Station is committed to ensuring the safety and security of the municipality of Malvar, Batangas. Strategically located to serve the growing community and its commercial hubs, the station is equipped with dedicated personnel and modern firefighting resources to respond swiftly to fire incidents, medical emergencies, and natural disasters. Beyond emergency response, BFP Malvar actively champions fire safety awareness, conducts comprehensive inspections, and partners closely with local barangays to build a highly resilient and prepared municipality.
                          </p>
                      </div>

                      {/* Vision, Mission, Core Values */}
                      <div className="lg:col-span-7 flex flex-col gap-5 justify-center">
                          {/* Vision */}
                          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:border-orange-200 transition-colors">
                              <h4 className="text-sm font-bold text-orange-600 uppercase tracking-widest mb-2.5 flex items-center gap-2">
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                  Vision
                              </h4>
                              <p className="text-gray-800 font-semibold text-lg leading-snug">"A modern and trusted fire and emergency service building safe and resilient communities."</p>
                          </div>
                          
                          {/* Mission */}
                          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:border-orange-200 transition-colors">
                              <h4 className="text-sm font-bold text-orange-600 uppercase tracking-widest mb-2.5 flex items-center gap-2">
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                  </svg>
                                  Mission
                              </h4>
                              <p className="text-gray-800 font-semibold text-[15px] leading-relaxed">"We protect life, property, and the environment through an integrated system of prevention, response, and investigation, strengthening public safety and community resilience."</p>
                          </div>

                          {/* Core Values */}
                          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:border-orange-200 transition-colors">
                              <h4 className="text-sm font-bold text-orange-600 uppercase tracking-widest mb-3.5 flex items-center gap-2">
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                  </svg>
                                  Core Values
                              </h4>
                              <div className="flex flex-col gap-3">
                                  {[
                                      { title: 'Tapat na Paglilingkod', desc: 'Integrity grounded in faith and respect' },
                                      { title: 'Galing sa Gawain', desc: 'Competence that responds with reliability' },
                                      { title: 'Pusong Nag-aalab', desc: 'Compassion rooted in courage and service' }
                                  ].map(value => (
                                      <div key={value.title} className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl">
                                          <span className="block text-sm font-extrabold text-orange-700 mb-0.5">{value.title}</span>
                                          <span className="block text-sm font-medium text-slate-600 leading-snug">{value.desc}</span>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          </section>

          {/* Education Hub Section */}
          <section id="education" className="w-full py-16 scroll-mt-16 bg-slate-50 border-b border-gray-200">
              <div className="max-w-7xl mx-auto px-4 md:px-8">
                  <EducationHub />
              </div>
          </section>

          {/* Online Fire Safety Services Section */}
          <section id="services" className="w-full py-20 scroll-mt-16 bg-slate-50 border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-4 md:px-8">

              {/* Section Header */}
              <div className="text-center mb-14">
                <span className="inline-flex items-center gap-1.5 bg-orange-100 text-orange-700 text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-4">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  Online Application Portal
                </span>
                <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">
                  Fire Safety Certification Services
                </h2>
                <p className="text-gray-500 max-w-2xl mx-auto text-base leading-relaxed">
                  Apply for your fire safety certificates online through the official BFP e-Services portal.
                  Fast, easy, and paperless.
                </p>
                {/* Portal CTA */}
                <a
                  href="https://fsis.e-bfp.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 mt-6 bg-orange-600 hover:bg-orange-700 text-white font-bold px-8 py-3.5 rounded-xl shadow-sm transition-colors duration-200"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Visit fsis.e-bfp.com
                </a>
                <p className="text-xs text-gray-400 mt-2">Official BFP Fire Safety Information System</p>
              </div>

              {/* Two cards — FSIC and FSEC */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">

                {/* ── FSIC Card ── */}
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden flex flex-col">
                  {/* Card header — flat orange */}
                  <div className="bg-orange-600 px-7 py-6 flex items-center gap-4">
                    <div className="bg-white bg-opacity-20 rounded-xl p-3 flex-shrink-0">
                      <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-orange-200 text-xs font-semibold uppercase tracking-widest">Certificate</p>
                      <h3 className="text-lg font-extrabold text-white leading-snug">
                        Fire Safety Inspection Certificate (FSIC)
                      </h3>
                    </div>
                  </div>

                  <div className="px-7 py-6 flex-1 flex flex-col gap-5">
                    <p className="text-gray-600 text-sm leading-relaxed">
                      Required for <strong className="text-gray-800">business owners and building occupants</strong> to legally operate. The FSIC certifies that your establishment complies with the Fire Code of the Philippines (R.A. 9514).
                    </p>

                    {/* Who needs it */}
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2.5">Who Needs It</p>
                      <div className="flex flex-col gap-2">
                        {[
                          'Existing businesses renewing their business permit',
                          'New establishments opening for the first time',
                          'Buildings resuming operations after renovation',
                        ].map((item) => (
                          <div key={item} className="flex items-start gap-2.5 text-sm text-gray-700">
                            <svg className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Requirements */}
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2.5">Documentary Requirements</p>
                      <ol className="flex flex-col gap-2">
                        {[
                          'Duly accomplished FSIC application form',
                          'Official Receipt of payment (Fire Code fees)',
                          'Floor plan / occupancy layout of the establishment',
                          'Certificate of Occupancy or Building Permit',
                          'Previous FSIC (for renewals)',
                          "Business Permit or Mayor's Permit",
                          'Proof of ownership or lease contract',
                        ].map((req, i) => (
                          <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700">
                            <span className="flex-shrink-0 w-5 h-5 rounded bg-orange-100 text-orange-700 text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                            {req}
                          </li>
                        ))}
                      </ol>
                    </div>

                    <a
                      href="https://fsis.e-bfp.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-auto flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl border-2 border-orange-600 text-orange-600 font-bold text-sm hover:bg-orange-600 hover:text-white transition-colors duration-200"
                    >
                      Apply for FSIC Online
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </a>
                  </div>
                </div>

                {/* ── FSEC Card ── */}
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden flex flex-col">
                  {/* Card header — flat slate */}
                  <div className="bg-slate-700 px-7 py-6 flex items-center gap-4">
                    <div className="bg-white bg-opacity-20 rounded-xl p-3 flex-shrink-0">
                      <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-slate-300 text-xs font-semibold uppercase tracking-widest">Clearance</p>
                      <h3 className="text-lg font-extrabold text-white leading-snug">
                        Fire Safety Evaluation Clearance (FSEC)
                      </h3>
                    </div>
                  </div>

                  <div className="px-7 py-6 flex-1 flex flex-col gap-5">
                    <p className="text-gray-600 text-sm leading-relaxed">
                      Required for <strong className="text-gray-800">building permit applicants</strong> before construction begins. The FSEC confirms that your building plans comply with fire safety standards under the Fire Code.
                    </p>

                    {/* Who needs it */}
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2.5">Who Needs It</p>
                      <div className="flex flex-col gap-2">
                        {[
                          'Applicants for a new building permit',
                          'Owners renovating or altering existing structures',
                          'Developers constructing residential or commercial buildings',
                        ].map((item) => (
                          <div key={item} className="flex items-start gap-2.5 text-sm text-gray-700">
                            <svg className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Requirements */}
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2.5">Documentary Requirements</p>
                      <ol className="flex flex-col gap-2">
                        {[
                          'Duly accomplished FSEC application form',
                          'Five (5) sets of building plans (architectural, electrical, mechanical, sanitary)',
                          'Bill of materials and specifications',
                          'Lot plan with vicinity map',
                          'Land title or Certificate of Land Ownership (CLOA)',
                          'Tax Declaration of property',
                          'Proof of payment of Fire Code fees',
                        ].map((req, i) => (
                          <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700">
                            <span className="flex-shrink-0 w-5 h-5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                            {req}
                          </li>
                        ))}
                      </ol>
                    </div>

                    <a
                      href="https://fsis.e-bfp.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-auto flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl border-2 border-slate-700 text-slate-700 font-bold text-sm hover:bg-slate-700 hover:text-white transition-colors duration-200"
                    >
                      Apply for FSEC Online
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </a>
                  </div>
                </div>
              </div>

              {/* Step-by-step instructions */}
              <div className="bg-white border border-gray-200 rounded-2xl p-8">
                <div className="text-center mb-8">
                  <h3 className="text-xl font-extrabold text-gray-800 mb-1">How to Apply Online</h3>
                  <p className="text-sm text-gray-500">
                    Follow these steps on{' '}
                    <a href="https://fsis.e-bfp.com" target="_blank" rel="noopener noreferrer" className="text-orange-600 font-semibold hover:underline">
                      fsis.e-bfp.com
                    </a>
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  {[
                    {
                      step: '01',
                      icon: (
                        <svg className="w-6 h-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      ),
                      title: 'Register / Log In',
                      desc: 'Create a free account on the BFP e-Services portal or log in if you already have one.',
                    },
                    {
                      step: '02',
                      icon: (
                        <svg className="w-6 h-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                        </svg>
                      ),
                      title: 'Fill Out Application',
                      desc: 'Select FSIC or FSEC, then complete the online application form with your establishment details.',
                    },
                    {
                      step: '03',
                      icon: (
                        <svg className="w-6 h-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                      ),
                      title: 'Upload Documents',
                      desc: 'Scan and upload all required documents in PDF or image format directly on the portal.',
                    },
                    {
                      step: '04',
                      icon: (
                        <svg className="w-6 h-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ),
                      title: 'Pay & Track',
                      desc: 'Pay the Fire Code fees online and monitor your application status in real time.',
                    },
                  ].map(({ step, icon, title, desc }) => (
                    <div key={step} className="flex flex-col items-center text-center bg-slate-50 border border-gray-200 rounded-xl p-5 hover:border-orange-200 transition-colors duration-200">
                      <div className="w-12 h-12 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center mb-3">
                        {icon}
                      </div>
                      <span className="text-[10px] font-black text-orange-500 tracking-widest mb-1">STEP {step}</span>
                      <h4 className="font-bold text-gray-800 text-sm mb-1.5">{title}</h4>
                      <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
                    </div>
                  ))}
                </div>

                {/* Disclaimer */}
                <div className="mt-7 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
                  <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    <strong className="text-gray-800">Note:</strong> Applications are processed by BFP personnel during regular office hours (8:00 AM – 5:00 PM, Monday to Friday). For walk-in transactions, visit the <strong className="text-gray-800">BFP Malvar Fire Station</strong> or call our hotlines. Requirements listed above are standard — additional documents may be required at the discretion of the fire inspector.
                  </p>
                </div>
              </div>

            </div>
          </section>

          {/* Map Section */}
          <section id="map" className="w-full py-16 scroll-mt-16 bg-white border-b border-gray-200">
              <div className="max-w-7xl mx-auto px-4 md:px-8">
                  <div className="text-center mb-10">
                      <h2 className="text-3xl font-bold text-gray-800 mb-3">Barangay Fire Risk Map</h2>
                      <p className="text-gray-500 max-w-2xl mx-auto">View AI-predicted fire risk levels for each barangay in Malvar, along with the BFP station, fire hydrants, and risk hotspots. Click any zone to see its risk score and contributing factors.</p>
                  </div>
                  <PublicCommunityMap />
              </div>
          </section>

          {/* Hotlines Section */}
          <section id="hotlines" className="w-full py-16 scroll-mt-16 bg-slate-50 border-white">
              <div className="max-w-7xl mx-auto px-4 md:px-8">
                  <EmergencyHotlines />
              </div>
          </section>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900 py-10 text-center text-slate-400 text-sm">
          <div className="max-w-7xl mx-auto px-6">
              <div className="flex items-center justify-center gap-2 mb-4">
                  <span className="font-bold text-lg text-white tracking-wide">mySunog</span>
              </div>
              <p>© {new Date().getFullYear()} Bureau of Fire Protection - Malvar. All Rights Reserved.</p>
              <p className="mt-2 text-slate-500 text-xs">A unified command and digital modernization initiative.</p>
          </div>
      </footer>
    </div>
  );
}
