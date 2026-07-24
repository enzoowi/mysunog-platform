import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, ExternalLink, Save, RotateCcw } from 'lucide-react';

const STORAGE_KEY = 'adminServicesConfig';

const DEFAULTS = {
  portalUrl: 'https://fsis.e-bfp.com',
  sectionDescription:
    'Apply for your fire safety certificates online through the official BFP e-Services portal. Fast, easy, and paperless.',
  disclaimer:
    'Applications are processed by BFP personnel during regular office hours (8:00 AM – 5:00 PM, Monday to Friday). For walk-in transactions, visit the BFP Malvar Fire Station or call our hotlines. Requirements listed above are standard — additional documents may be required at the discretion of the fire inspector.',
};

function loadConfig(): typeof DEFAULTS {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export default function AdminServices() {
  const [config, setConfig] = useState(loadConfig);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function handleReset() {
    if (!window.confirm('Reset all fields to their defaults?')) return;
    setConfig({ ...DEFAULTS });
    localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link
        to="/admin/dashboard"
        className="inline-flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-orange-100 p-2.5 rounded-xl">
          <ShieldCheck className="w-7 h-7 text-orange-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Manage Services</h1>
          <p className="text-sm text-gray-500">
            Edit the <strong>Fire Safety Certification Services</strong> section displayed on the home page.
          </p>
        </div>
      </div>

      {/* Preview link */}
      <div className="bg-orange-50 border border-orange-200 rounded-xl px-5 py-3 mb-6 flex items-center justify-between">
        <p className="text-sm text-orange-800 font-medium">
          🏠 This section appears on the public home page under{' '}
          <code className="bg-orange-100 px-1 rounded">#services</code>
        </p>
        <a
          href="/#services"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 font-semibold"
        >
          Preview <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Editable fields */}
      <div className="bg-white border rounded-xl shadow-sm divide-y divide-gray-100">

        {/* Portal URL */}
        <div className="p-5">
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            BFP e-Services Portal URL
          </label>
          <p className="text-xs text-gray-400 mb-2">
            The link used on the "Visit fsis.e-bfp.com" button and all "Apply Online" buttons.
          </p>
          <input
            type="url"
            value={config.portalUrl}
            onChange={(e) => setConfig((c) => ({ ...c, portalUrl: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
            placeholder="https://fsis.e-bfp.com"
          />
        </div>

        {/* Section description */}
        <div className="p-5">
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Section Description
          </label>
          <p className="text-xs text-gray-400 mb-2">
            The paragraph shown below the "Fire Safety Certification Services" heading.
          </p>
          <textarea
            rows={3}
            value={config.sectionDescription}
            onChange={(e) => setConfig((c) => ({ ...c, sectionDescription: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent resize-none"
          />
        </div>

        {/* Disclaimer */}
        <div className="p-5">
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Disclaimer / Note
          </label>
          <p className="text-xs text-gray-400 mb-2">
            The amber note shown at the bottom of the "How to Apply Online" section.
          </p>
          <textarea
            rows={4}
            value={config.disclaimer}
            onChange={(e) => setConfig((c) => ({ ...c, disclaimer: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent resize-none"
          />
        </div>
      </div>

      {/* Read-only note */}
      <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl px-5 py-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Fixed Content</p>
        <p className="text-sm text-slate-600">
          The FSIC and FSEC card content (requirements, who needs it) and the 4-step "How to Apply" instructions
          are fixed informational content based on official BFP standards. Contact your system developer to update them.
        </p>
      </div>

      {/* Action buttons */}
      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-xl transition text-sm shadow-sm"
        >
          <Save className="w-4 h-4" />
          {saved ? '✓ Saved!' : 'Save Changes'}
        </button>
        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 text-gray-600 hover:bg-gray-50 font-medium rounded-xl transition text-sm"
        >
          <RotateCcw className="w-4 h-4" />
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}
