'use client';

import { motion } from 'framer-motion';
import { Phone, Mail, Calendar, User, Target, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { salesTeam, leads, leadStatusColors, businessTypeConfig } from './data';
import type { LeadStatus } from './data';

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const itemVariants = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.25 } } };

const pipelineColumns: { status: LeadStatus; label: string }[] = [
  { status: 'NEW', label: 'New' },
  { status: 'CONTACTED', label: 'Contacted' },
  { status: 'QUALIFIED', label: 'Qualified' },
  { status: 'PROPOSAL_SENT', label: 'Proposal' },
  { status: 'NEGOTIATION', label: 'Negotiation' },
  { status: 'WON', label: 'Won' },
];

export function SalesView() {
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* Sales Team */}
      <motion.div variants={itemVariants}>
        <h3 className="text-base font-semibold text-slate-900 mb-3">Sales Team</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {salesTeam.map(rep => (
            <Card key={rep.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">{rep.name.split(' ').map(n => n[0]).join('')}</div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">{rep.name}</p>
                    <p className="text-[10px] text-slate-500">{rep.region}</p>
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500">
                      <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{rep.phone}</span>
                      <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{rep.email}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      <div className="text-center p-2 bg-slate-50 rounded">
                        <p className="text-lg font-bold text-slate-900">{rep.leads}</p>
                        <p className="text-[9px] text-slate-500">Leads</p>
                      </div>
                      <div className="text-center p-2 bg-slate-50 rounded">
                        <p className="text-lg font-bold text-emerald-600">{rep.conversions}</p>
                        <p className="text-[9px] text-slate-500">Won</p>
                      </div>
                      <div className="text-center p-2 bg-slate-50 rounded">
                        <p className="text-sm font-bold text-slate-900">₹{(rep.achieved / 100000).toFixed(1)}L</p>
                        <p className="text-[9px] text-slate-500">Achieved</p>
                      </div>
                    </div>
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-[10px] mb-1">
                        <span className="text-slate-500">Target: ₹{(rep.target / 100000).toFixed(0)}L</span>
                        <span className="font-medium text-emerald-600">{Math.round(rep.achieved / rep.target * 100)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, rep.achieved / rep.target * 100)}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>

      {/* Lead Pipeline */}
      <motion.div variants={itemVariants}>
        <h3 className="text-base font-semibold text-slate-900 mb-3">Lead Pipeline</h3>
        <div className="overflow-x-auto">
          <div className="flex gap-3 min-w-[900px]">
            {pipelineColumns.map(col => {
              const colLeads = leads.filter(l => l.status === col.status);
              return (
                <div key={col.status} className="flex-1 min-w-[140px]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-700">{col.label}</span>
                    <Badge variant="secondary" className="text-[9px] h-4">{colLeads.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {colLeads.map(lead => (
                      <Card key={lead.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-3">
                          <p className="text-xs font-medium text-slate-900 truncate">{lead.businessName}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{lead.contactName}</p>
                          <div className="flex items-center gap-1.5 mt-2">
                            <Badge variant="outline" className="text-[8px] h-4">{businessTypeConfig[lead.type]?.label || lead.type}</Badge>
                          </div>
                          <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400">
                            <span>₹{(lead.estimatedValue / 12).toLocaleString()}/mo</span>
                            <span>{lead.salesRep?.split(' ')[0]}</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* All Leads Table */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">All Leads</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-2 px-3 font-semibold text-slate-700">Business</th>
                    <th className="text-left py-2 px-3 font-semibold text-slate-700">Contact</th>
                    <th className="text-left py-2 px-3 font-semibold text-slate-700">Type</th>
                    <th className="text-left py-2 px-3 font-semibold text-slate-700">Source</th>
                    <th className="text-left py-2 px-3 font-semibold text-slate-700">Status</th>
                    <th className="text-left py-2 px-3 font-semibold text-slate-700">Rep</th>
                    <th className="text-right py-2 px-3 font-semibold text-slate-700">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {leads.map(lead => (
                    <tr key={lead.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-medium text-slate-900">{lead.businessName}</td>
                      <td className="py-2 px-3 text-slate-600">{lead.contactName}</td>
                      <td className="py-2 px-3"><Badge variant="outline" className="text-[8px] h-4">{businessTypeConfig[lead.type]?.label}</Badge></td>
                      <td className="py-2 px-3 text-slate-500">{lead.source.replace(/_/g, ' ')}</td>
                      <td className="py-2 px-3"><Badge className={`text-[9px] h-5 ${leadStatusColors[lead.status]}`} variant="secondary">{lead.status.replace(/_/g, ' ')}</Badge></td>
                      <td className="py-2 px-3 text-slate-500">{lead.salesRep?.split(' ')[0]}</td>
                      <td className="py-2 px-3 text-right font-medium">₹{(lead.estimatedValue / 12).toLocaleString()}/mo</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
