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
        <div className="text-center py-16">
          <div className="w-20 h-20 rounded-2xl bg-emerald-600 flex items-center justify-center mx-auto mb-6">
            <span className="text-white font-bold text-2xl">QX</span>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Quantix Core Platform v1.0</h2>
          <p className="text-gray-500 max-w-lg mx-auto mb-8">
            Backend architecture is complete and verified. 42 models, 20 enums, 40+ API endpoints,
            14 core libraries. All 10 core modules are built and functional.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 max-w-2xl mx-auto mb-12">
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-2xl font-bold text-emerald-600">10</p>
              <p className="text-xs text-gray-500">Core Modules</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">42</p>
              <p className="text-xs text-gray-500">DB Models</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-2xl font-bold text-amber-600">40+</p>
              <p className="text-xs text-gray-500">API Routes</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-2xl font-bold text-purple-600">6</p>
              <p className="text-xs text-gray-500">Roles</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-2xl font-bold text-rose-600">11</p>
              <p className="text-xs text-gray-500">Business Types</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {[
              { icon: '🏗️', name: 'Multi-Tenant', desc: 'Business & Store row-level isolation' },
              { icon: '🔐', name: 'Auth (OTP)', desc: 'Email, WhatsApp, Push — no SMS' },
              { icon: '👥', name: 'RBAC', desc: '6 roles with 14 permission modules' },
              { icon: '🏢', name: 'Businesses', desc: 'Managed white-label creation' },
              { icon: '🏪', name: 'Stores', desc: 'Multi-store with delivery config' },
              { icon: '💳', name: 'POS Core', desc: 'Thermal printers, GST, settlement' },
              { icon: '🚚', name: 'Delivery', desc: 'Haversine, OTP, pickup & delivery' },
              { icon: '📋', name: 'Subscriptions', desc: 'Platform + Customer credit plans' },
              { icon: '🔔', name: 'Notifications', desc: 'Push, WhatsApp, Email' },
              { icon: '💰', name: 'Payments', desc: 'Multi-gateway with refunds' },
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
              &copy; 2025 Quantix Technology &middot; Core Platform v1.0
            </span>
          </div>
          <div className="flex items-center gap-4 text-[10px] text-gray-400">
            <span>quantixtechnology.in</span>
            <span>&middot;</span>
            <span>Next.js 16 + Prisma + SQLite</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
