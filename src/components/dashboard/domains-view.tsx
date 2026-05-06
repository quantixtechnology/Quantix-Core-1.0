'use client';

import { motion } from 'framer-motion';
import { Globe, Server, Shield, CheckCircle2, AlertCircle, Clock, Loader2, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { domains, deployments, domainStatusColors } from './data';
import type { DomainStatus, DeploymentStatus } from './data';

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const itemVariants = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.25 } } };

const deployStatusColors: Record<DeploymentStatus, string> = {
  PENDING: 'bg-slate-100 text-slate-600',
  BUILDING: 'bg-blue-100 text-blue-700',
  DEPLOYING: 'bg-amber-100 text-amber-700',
  LIVE: 'bg-emerald-100 text-emerald-700',
  FAILED: 'bg-red-100 text-red-700',
  MAINTENANCE: 'bg-yellow-100 text-yellow-700',
};

const healthIcons: Record<string, React.ElementType> = { healthy: CheckCircle2, degraded: AlertCircle, down: AlertCircle, unknown: Clock };
const healthColors: Record<string, string> = { healthy: 'text-emerald-500', degraded: 'text-amber-500', down: 'text-red-500', unknown: 'text-slate-400' };

export function DomainsView() {
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* Domain Mappings */}
      <motion.div variants={itemVariants}>
        <h3 className="text-base font-semibold text-slate-900 mb-3">Domain Mappings</h3>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-2.5 px-4 font-semibold text-slate-700">Business</th>
                    <th className="text-left py-2.5 px-4 font-semibold text-slate-700">Domain</th>
                    <th className="text-left py-2.5 px-4 font-semibold text-slate-700">DNS Provider</th>
                    <th className="text-left py-2.5 px-4 font-semibold text-slate-700">SSL</th>
                    <th className="text-left py-2.5 px-4 font-semibold text-slate-700">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {domains.map(dom => (
                    <tr key={dom.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-medium text-slate-900">{dom.businessName}</td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <Globe className="h-3 w-3 text-slate-400" />
                          <span className="font-mono text-slate-700">{dom.domain}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">{dom.dnsProvider}</td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-1">
                          <Shield className={`h-3 w-3 ${dom.sslStatus === 'active' ? 'text-emerald-500' : 'text-amber-500'}`} />
                          <span className={dom.sslStatus === 'active' ? 'text-emerald-600' : 'text-amber-600'}>{dom.sslStatus}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4"><Badge className={`text-[9px] h-5 ${domainStatusColors[dom.status]}`} variant="secondary">{dom.status.replace(/_/g, ' ')}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* DNS Configuration Flow */}
      <motion.div variants={itemVariants}>
        <Card className="bg-slate-50 border-dashed">
          <CardContent className="p-4">
            <h4 className="text-xs font-semibold text-slate-700 mb-2">Domain Configuration Flow (Quantix Only)</h4>
            <div className="flex flex-wrap items-center gap-2 text-[10px]">
              <span className="bg-white px-2 py-1 rounded border">Client provides domain</span>
              <span className="text-emerald-500">→</span>
              <span className="bg-white px-2 py-1 rounded border">Quantix configures DNS</span>
              <span className="text-emerald-500">→</span>
              <span className="bg-white px-2 py-1 rounded border">DNS propagation</span>
              <span className="text-emerald-500">→</span>
              <span className="bg-white px-2 py-1 rounded border">SSL provisioning</span>
              <span className="text-emerald-500">→</span>
              <span className="bg-emerald-100 px-2 py-1 rounded border">Live with HTTPS ✅</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-2">⚠️ Clients CANNOT manage hosting or DNS. Quantix handles all infrastructure.</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Deployments */}
      <motion.div variants={itemVariants}>
        <h3 className="text-base font-semibold text-slate-900 mb-3">Deployments</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {deployments.map(dep => {
            const HealthIcon = healthIcons[dep.healthStatus] || Clock;
            return (
              <Card key={dep.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Badge className={`text-[9px] h-5 ${deployStatusColors[dep.status]}`} variant="secondary">{dep.status}</Badge>
                    <HealthIcon className={`h-4 w-4 ${healthColors[dep.healthStatus]}`} />
                  </div>
                  <p className="text-xs font-semibold text-slate-900">{dep.businessName}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{dep.type.replace(/_/g, ' ')}</p>
                  <div className="flex items-center justify-between mt-3 text-[10px]">
                    <span className="text-slate-500">{dep.hostingProvider}</span>
                    <span className="text-slate-400">v{dep.version}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </motion.div>

      {/* Hosting Providers */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardContent className="p-4">
            <h4 className="text-xs font-semibold text-slate-700 mb-2">Hosting Strategy</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { name: 'Replit', status: 'Current', color: 'bg-emerald-100 text-emerald-700' },
                { name: 'Vercel', status: 'Future', color: 'bg-slate-100 text-slate-500' },
                { name: 'AWS', status: 'Future', color: 'bg-slate-100 text-slate-500' },
                { name: 'DigitalOcean', status: 'Future', color: 'bg-slate-100 text-slate-500' },
              ].map(provider => (
                <div key={provider.name} className="text-center p-3 rounded-lg border border-slate-200">
                  <p className="text-xs font-bold text-slate-900">{provider.name}</p>
                  <Badge className={`text-[9px] h-4 mt-1 ${provider.color}`} variant="secondary">{provider.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
