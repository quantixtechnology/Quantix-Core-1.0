'use client';

import { Check, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { platformPlans } from './data';

export function PlansView() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="p-4">
          <p className="text-xs text-amber-700"><strong>⚠️ Managed Platform:</strong> Plans are defined by Quantix only. Super Admin can override pricing per customer. Custom plans are supported.</p>
        </CardContent>
      </Card>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {platformPlans.map(plan => (
          <Card key={plan.id} className={`hover:shadow-md transition-shadow duration-200 ${plan.tier === 'PROFESSIONAL' ? 'ring-2 ring-emerald-500' : ''}`}>
            <CardContent className="p-5">
              {plan.tier === 'PROFESSIONAL' && <Badge className="mb-3 bg-emerald-100 text-emerald-700 text-[9px]">Most Popular</Badge>}
              <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
              <div className="mt-2">
                <span className="text-3xl font-bold text-slate-900">₹{plan.monthlyPrice.toLocaleString()}</span>
                <span className="text-xs text-slate-500">/month</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">or ₹{plan.yearlyPrice.toLocaleString()}/year</p>

              <div className="mt-4 space-y-2">
                {[
                  { label: 'Max Stores', value: plan.maxStores },
                  { label: 'Max Products', value: plan.maxProducts },
                  { label: 'Max Orders/mo', value: plan.maxOrders.toLocaleString() },
                  { label: 'POS System', value: plan.hasPOS },
                  { label: 'Delivery', value: plan.hasDelivery },
                  { label: 'Subscription Service', value: plan.hasSubscription },
                  { label: 'Custom Domain', value: plan.hasCustomDomain },
                  { label: 'White Label', value: plan.hasWhiteLabel },
                ].map(feature => (
                  <div key={feature.label} className="flex items-center gap-2 text-xs">
                    {typeof feature.value === 'boolean' ? (
                      feature.value ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <X className="h-3.5 w-3.5 text-slate-300" />
                    ) : (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    )}
                    <span className={typeof feature.value === 'boolean' && !feature.value ? 'text-slate-400' : 'text-slate-700'}>
                      {feature.label} {typeof feature.value !== 'boolean' && <strong>{feature.value}</strong>}
                    </span>
                  </div>
                ))}
              </div>

              <Button
                className={`w-full mt-4 text-xs h-9 ${plan.tier === 'PROFESSIONAL' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
                variant={plan.tier === 'PROFESSIONAL' ? 'default' : 'outline'}
              >
                Assign to Business
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Custom Pricing Note */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Custom Pricing Override</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 text-xs text-slate-600 space-y-2">
          <p>Super Admin can override plan pricing on a per-customer basis:</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Custom Price', desc: 'Override monthly/yearly amount' },
              { label: 'Discount %', desc: 'Percentage off plan price' },
              { label: 'Trial Extension', desc: 'Extend trial period in days' },
              { label: 'Subscription Pause', desc: 'Pause billing temporarily' },
            ].map(item => (
              <div key={item.label} className="p-2.5 bg-slate-50 rounded-lg">
                <p className="font-semibold text-slate-900">{item.label}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{item.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
