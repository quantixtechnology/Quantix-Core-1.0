'use client';

import { FileText, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const demoInvoices = [
  { id: 'inv1', number: 'INV-2025-001', business: 'FreshMart', customer: 'Rajesh Kumar', amount: 1250, cgst: 56.25, sgst: 56.25, igst: 0, total: 1362.50, date: '2025-01-15', status: 'PAID' },
  { id: 'inv2', number: 'INV-2025-002', business: 'SpiceRoute', customer: 'Sneha Patil', amount: 850, cgst: 42.50, sgst: 42.50, igst: 0, total: 935.00, date: '2025-01-15', status: 'PAID' },
  { id: 'inv3', number: 'INV-2025-003', business: 'QuickClean', customer: 'Anand Joshi', amount: 450, cgst: 22.50, sgst: 22.50, igst: 0, total: 495.00, date: '2025-01-15', status: 'PENDING' },
  { id: 'inv4', number: 'INV-2025-004', business: 'FreshMart', customer: 'Mohan Sharma', amount: 3200, cgst: 160, sgst: 160, igst: 0, total: 3520.00, date: '2025-01-15', status: 'PAID' },
];

export function InvoicesView() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2.5 px-3 font-semibold text-slate-700">Invoice</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-slate-700">Business</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-slate-700">Customer</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-slate-700">CGST</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-slate-700">SGST</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-slate-700">IGST</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-slate-700">Total</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-slate-700">Status</th>
                  <th className="text-right py-2.5 px-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {demoInvoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors duration-150">
                    <td className="py-2.5 px-3 font-mono font-medium text-slate-900">{inv.number}</td>
                    <td className="py-2.5 px-3 text-slate-600">{inv.business}</td>
                    <td className="py-2.5 px-3 text-slate-600">{inv.customer}</td>
                    <td className="py-2.5 px-3 text-slate-600">₹{inv.cgst.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-slate-600">₹{inv.sgst.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-slate-600">{inv.igst ? `₹${inv.igst.toFixed(2)}` : '—'}</td>
                    <td className="py-2.5 px-3 text-right font-medium">₹{inv.total.toFixed(2)}</td>
                    <td className="py-2.5 px-3"><Badge className={`text-[9px] h-5 ${inv.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`} variant="secondary">{inv.status}</Badge></td>
                    <td className="py-2.5 px-3 text-right"><Button variant="ghost" size="icon" className="h-6 w-6"><Download className="h-3 w-3" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-50 border-dashed">
        <CardContent className="p-4 text-xs text-slate-600">
          <strong>GST Invoice:</strong> All invoices include CGST/SGST for intra-state and IGST for inter-state transactions. HSN codes supported. Compliant with Indian GST regulations.
        </CardContent>
      </Card>
    </div>
  );
}
