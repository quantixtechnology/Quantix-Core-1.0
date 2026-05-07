export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">QX</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Quantix Core Platform</h1>
              <p className="text-xs text-gray-500">Managed White-Label Multi-Tenant SaaS</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        <div className="text-center py-12">
          <div className="w-20 h-20 rounded-2xl bg-emerald-600 flex items-center justify-center mx-auto mb-6">
            <span className="text-white font-bold text-2xl">QX</span>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Quantix Core Platform v2.0</h2>
          <p className="text-gray-500 max-w-lg mx-auto mb-8">
            Managed white-label architecture. No self-signup. No free trial. 
            Every business is onboarded through verified leads and payment.
          </p>

          {/* Pricing Plans */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-xl mx-auto mb-12">
            <div className="bg-white rounded-xl border-2 border-emerald-200 p-6 text-center flex-1 w-full">
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-1">Monthly</p>
              <p className="text-3xl font-bold text-gray-900"><span className="text-base text-gray-400">&#8377;</span>4,999</p>
              <p className="text-xs text-gray-500 mt-1">per month</p>
            </div>
            <div className="bg-emerald-600 rounded-xl p-6 text-center flex-1 w-full text-white">
              <p className="text-xs font-semibold uppercase tracking-wider mb-1 opacity-80">Yearly</p>
              <p className="text-3xl font-bold"><span className="text-base opacity-60">&#8377;</span>49,999</p>
              <p className="text-xs opacity-80 mt-1">per year &middot; Save ~2 months</p>
            </div>
          </div>

          {/* Key Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto mb-12">
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-2xl font-bold text-emerald-600">8</p>
              <p className="text-xs text-gray-500">Lead Stages</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-2xl font-bold text-amber-600">2</p>
              <p className="text-xs text-gray-500">Fixed Plans</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-2xl font-bold text-rose-600">0</p>
              <p className="text-xs text-gray-500">Free Trials</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-2xl font-bold text-purple-600">6</p>
              <p className="text-xs text-gray-500">Roles</p>
            </div>
          </div>

          {/* Lead Lifecycle */}
          <div className="max-w-4xl mx-auto mb-12">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Lead Lifecycle</h3>
            <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-2">
              {[
                { label: 'Lead', color: 'bg-slate-100 text-slate-700' },
                { label: 'Demo', color: 'bg-blue-100 text-blue-700' },
                { label: 'Negotiation', color: 'bg-amber-100 text-amber-700' },
                { label: 'Payment Pending', color: 'bg-orange-100 text-orange-700' },
                { label: 'Payment Received', color: 'bg-teal-100 text-teal-700' },
                { label: 'Onboarding', color: 'bg-violet-100 text-violet-700' },
                { label: 'Deployment', color: 'bg-indigo-100 text-indigo-700' },
                { label: 'Active', color: 'bg-emerald-100 text-emerald-700' },
              ].map((stage, i) => (
                <div key={stage.label} className="flex items-center gap-1 sm:gap-2">
                  <span className={`text-xs font-medium px-2.5 py-1.5 rounded-full ${stage.color}`}>
                    {stage.label}
                  </span>
                  {i < 7 && (
                    <span className="text-gray-300 text-xs">&#8594;</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Core Modules */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {[
              { icon: '🏗️', name: 'Multi-Tenant', desc: 'Business & Store row-level isolation' },
              { icon: '🔐', name: 'Auth (OTP)', desc: 'Email, WhatsApp, Push — no SMS' },
              { icon: '👥', name: 'RBAC', desc: '6 roles, no self-signup for businesses' },
              { icon: '🎯', name: 'Lead Pipeline', desc: '8-stage lifecycle, demo, negotiation' },
              { icon: '🖥️', name: 'Demo Tenants', desc: 'Shared demo environment for prospects' },
              { icon: '🏢', name: 'Businesses', desc: 'Quantix-managed creation only' },
              { icon: '🏪', name: 'Stores', desc: 'Multi-store with delivery config' },
              { icon: '💳', name: 'POS Core', desc: 'Thermal printers, GST, settlement' },
              { icon: '🚚', name: 'Delivery', desc: 'Haversine, OTP, pickup & delivery' },
              { icon: '📋', name: 'Subscriptions', desc: '2 fixed plans + Super Admin overrides' },
              { icon: '🔔', name: 'Notifications', desc: 'Push, WhatsApp, Email' },
              { icon: '💰', name: 'Payments', desc: 'Multi-gateway with refunds' },
              { icon: '🚀', name: 'Onboarding', desc: 'Step-by-step tracked setup' },
              { icon: '🌐', name: 'Deployments', desc: 'Quantix-controlled domain & hosting' },
            ].map((mod) => (
              <div key={mod.name} className="bg-white rounded-lg border border-gray-200 p-4 text-left">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{mod.icon}</span>
                  <h3 className="font-semibold text-gray-900 text-sm">{mod.name}</h3>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">Done</span>
                </div>
                <p className="text-xs text-gray-500">{mod.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="bg-white border-t border-gray-200 px-4 sm:px-6 py-3 flex-shrink-0 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-emerald-600 flex items-center justify-center">
              <span className="text-white font-bold text-[8px]">QX</span>
            </div>
            <span className="text-xs text-gray-500">
              &copy; 2025 Quantix Technology &middot; Core Platform v2.0
            </span>
          </div>
          <div className="flex items-center gap-4 text-[10px] text-gray-400">
            <span>quantixtechnology.in</span>
            <span>&middot;</span>
            <span>Managed &middot; White-Label &middot; No Self-Signup</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
