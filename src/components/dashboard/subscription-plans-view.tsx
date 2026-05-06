'use client';

import { motion } from 'framer-motion';
import { Check, CreditCard, Repeat } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { carWashPlans } from './data';

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const itemVariants = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.25 } } };

const activeSubs = [
  { id: 'cs1', customer: 'Deepa Nair', plan: 'Premium Care', credits: 17, used: 5, remaining: 12, expires: '2025-02-15' },
  { id: 'cs2', customer: 'Vikram Singh', plan: 'Basic Wash', credits: 8, used: 6, remaining: 2, expires: '2025-01-28' },
  { id: 'cs3', customer: 'Priya Patel', plan: 'Ultimate Shine', credits: 30, used: 22, remaining: 8, expires: '2025-02-10' },
];

export function SubscriptionPlansView() {
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants}>
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="p-4">
            <p className="text-xs text-emerald-700"><strong>Subscription Service Engine</strong> — For Car Wash, Home Services, Laundry etc. Credit-based packages with tracking, expiry, and renewal.</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {carWashPlans.map(plan => (
          <motion.div key={plan.id} variants={itemVariants}>
            <Card className={`hover:shadow-md transition-shadow ${plan.name === 'Premium Care' ? 'ring-2 ring-emerald-500' : ''}`}>
              <CardContent className="p-5">
                {plan.name === 'Premium Care' && <Badge className="mb-2 bg-emerald-100 text-emerald-700 text-[9px]">Most Popular</Badge>}
                <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
                <div className="mt-1"><span className="text-2xl font-bold text-slate-900">₹{plan.price.toLocaleString()}</span><span className="text-xs text-slate-500">/month</span></div>
                <p className="text-[10px] text-slate-500 mt-1">{plan.credits} {plan.creditLabel} per cycle</p>
                <div className="mt-4 space-y-1.5">
                  {plan.features.map(f => (
                    <div key={f} className="flex items-center gap-1.5 text-xs text-slate-700">
                      <Check className="h-3.5 w-3.5 text-emerald-500" />{f}
                    </div>
                  ))}
                </div>
                <Button className={`w-full mt-4 text-xs h-9 ${plan.name === 'Premium Care' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`} variant={plan.name === 'Premium Care' ? 'default' : 'outline'}>
                  Subscribe
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Active Subscriptions */}
      <motion.div variants={itemVariants}>
        <h3 className="text-base font-semibold text-slate-900 mb-3">Active Subscriptions</h3>
        <div className="space-y-3">
          {activeSubs.map(sub => (
            <Card key={sub.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{sub.customer}</p>
                    <p className="text-[10px] text-slate-500">{sub.plan}</p>
                  </div>
                  <Badge className="text-[9px] h-5 bg-emerald-100 text-emerald-700">Active</Badge>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center text-[10px] mb-2">
                  <div><p className="font-bold text-slate-900">{sub.credits}</p><p className="text-slate-500">Total</p></div>
                  <div><p className="font-bold text-amber-600">{sub.used}</p><p className="text-slate-500">Used</p></div>
                  <div><p className="font-bold text-emerald-600">{sub.remaining}</p><p className="text-slate-500">Remaining</p></div>
                </div>
                <Progress value={(sub.used / sub.credits) * 100} className="h-1.5" />
                <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400">
                  <span>{Math.round((sub.used / sub.credits) * 100)}% used</span>
                  <span>Expires: {sub.expires}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
