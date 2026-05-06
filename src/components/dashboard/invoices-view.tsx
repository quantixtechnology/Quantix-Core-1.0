'use client';

import { motion } from 'framer-motion';
import { FileText, Download, Eye, Search, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { invoices, type Invoice } from './data';
import { useState } from 'react';

const statusColors: Record<string, string> = {
  paid: 'bg-emerald-100 text-emerald-700',
  pending: 'bg-amber-100 text-amber-700',
  overdue: 'bg-red-100 text-red-700',
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

export function InvoicesView() {
  const [search, setSearch] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const filtered = invoices.filter(
    (inv) =>
      inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      inv.businessName.toLowerCase().includes(search.toLowerCase())
  );

  const totalRevenue = invoices.filter((i) => i.status === 'paid').reduce((a, i) => a + i.total, 0);
  const pendingAmount = invoices.filter((i) => i.status === 'pending').reduce((a, i) => a + i.total, 0);
  const overdueAmount = invoices.filter((i) => i.status === 'overdue').reduce((a, i) => a + i.total, 0);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Invoices</h2>
          <p className="text-sm text-slate-500">GST compliant invoice management</p>
        </div>
        <Button variant="outline" size="sm" className="text-xs h-9">
          <Download className="h-3.5 w-3.5 mr-2" />
          Export All
        </Button>
      </motion.div>

      {/* Stats */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600"><FileText className="h-5 w-5" /></div>
            <div>
              <p className="text-2xl font-bold text-emerald-700">₹{(totalRevenue / 1000).toFixed(0)}K</p>
              <p className="text-xs text-slate-500">Collected</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600"><FileText className="h-5 w-5" /></div>
            <div>
              <p className="text-2xl font-bold text-amber-700">₹{(pendingAmount / 1000).toFixed(0)}K</p>
              <p className="text-xs text-slate-500">Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-50 text-red-600"><FileText className="h-5 w-5" /></div>
            <div>
              <p className="text-2xl font-bold text-red-700">₹{(overdueAmount / 1000).toFixed(0)}K</p>
              <p className="text-xs text-slate-500">Overdue</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Search */}
      <motion.div variants={itemVariants}>
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search invoices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </motion.div>

      {/* Invoice Table */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Invoice #</TableHead>
                  <TableHead className="text-xs">Business</TableHead>
                  <TableHead className="text-xs hidden sm:table-cell">Description</TableHead>
                  <TableHead className="text-xs">Amount</TableHead>
                  <TableHead className="text-xs hidden md:table-cell">GST</TableHead>
                  <TableHead className="text-xs">Total</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="text-xs font-medium text-emerald-700">{invoice.invoiceNumber}</TableCell>
                    <TableCell className="text-xs">{invoice.businessName}</TableCell>
                    <TableCell className="text-xs hidden sm:table-cell text-slate-500">{invoice.description}</TableCell>
                    <TableCell className="text-xs">₹{invoice.amount.toLocaleString()}</TableCell>
                    <TableCell className="text-xs hidden md:table-cell">
                      <div className="text-[10px]">
                        {invoice.cgst > 0 && <span>CGST: ₹{invoice.cgst}</span>}
                        {invoice.sgst > 0 && <span> SGST: ₹{invoice.sgst}</span>}
                        {invoice.igst > 0 && <span>IGST: ₹{invoice.igst}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-semibold">₹{invoice.total.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge className={`text-[9px] h-5 ${statusColors[invoice.status]}`} variant="secondary">
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setSelectedInvoice(invoice)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>

      {/* Invoice Detail Dialog */}
      <Dialog open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-emerald-700">{selectedInvoice?.invoiceNumber}</DialogTitle>
            <DialogDescription>GST Invoice Details</DialogDescription>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Business</span>
                  <span className="font-medium">{selectedInvoice.businessName}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Description</span>
                  <span className="font-medium">{selectedInvoice.description}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Issue Date</span>
                  <span>{selectedInvoice.issueDate}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Due Date</span>
                  <span>{selectedInvoice.dueDate}</span>
                </div>
              </div>

              <div className="border rounded-lg p-4 space-y-2">
                <h4 className="text-xs font-semibold text-slate-700 mb-2">Tax Breakdown</h4>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Base Amount</span>
                  <span>₹{selectedInvoice.amount.toLocaleString()}</span>
                </div>
                {selectedInvoice.cgst > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">CGST (9%)</span>
                    <span>₹{selectedInvoice.cgst}</span>
                  </div>
                )}
                {selectedInvoice.sgst > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">SGST (9%)</span>
                    <span>₹{selectedInvoice.sgst}</span>
                  </div>
                )}
                {selectedInvoice.igst > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">IGST (18%)</span>
                    <span>₹{selectedInvoice.igst}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold pt-2 border-t">
                  <span>Total</span>
                  <span className="text-emerald-700">₹{selectedInvoice.total.toLocaleString()}</span>
                </div>
              </div>

              <Badge className={`text-xs ${statusColors[selectedInvoice.status]}`} variant="secondary">
                {selectedInvoice.status.charAt(0).toUpperCase() + selectedInvoice.status.slice(1)}
              </Badge>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
