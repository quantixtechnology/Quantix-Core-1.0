'use client';

import { motion } from 'framer-motion';
import { Check, Star, Zap, Crown, CreditCard, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { subscriptions, subscriptionPlans, type SubscriptionStatus } from './data';

const statusColors: Record<SubscriptionStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  expired: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-600',
  trial: 'bg-amber-100 text-amber-700',
};

const planIcons: Record<string, React.ElementType> = {
  starter: Star,
  growth: Zap,
  enterprise: Crown,
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

export function SubscriptionsView() {
  const activeCount = subscriptions.filter((s) => s.status === 'active').length;
  const totalMRR = subscriptions.filter((s) => s.status === 'active').reduce((a, s) => a + s.monthlyFee, 0);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h2 className="text-xl font-bold text-slate-900">Subscriptions</h2>
        <p className="text-sm text-slate-500">Manage plans, billing, and credit usage</p>
      </motion.div>

      {/* Stats */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600"><CreditCard className="h-5 w-5" /></div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{activeCount}</p>
              <p className="text-xs text-slate-500">Active Subscriptions</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600"><TrendingUp className="h-5 w-5" /></div>
            <div>
              <p className="text-2xl font-bold text-slate-900">₹{(totalMRR / 1000).toFixed(0)}K</p>
              <p className="text-xs text-slate-500">Monthly Recurring Revenue</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-50 text-violet-600"><Crown className="h-5 w-5" /></div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{subscriptions.filter((s) => s.status === 'trial').length}</p>
              <p className="text-xs text-slate-500">Trial Accounts</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Pricing Plans */}
      <motion.div variants={itemVariants}>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Subscription Plans</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {subscriptionPlans.map((plan) => {
            const Icon = plan.name === 'Starter' ? Star : plan.name === 'Growth' ? Zap : Crown;
            return (
              <Card key={plan.name} className={`relative border-2 ${plan.color}`}>
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-emerald-600 text-white text-[10px]">{plan.badge}</Badge>
                  </div>
                )}
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`p-2 rounded-lg ${
                      plan.name === 'Starter' ? 'bg-slate-100 text-slate-600' :
                      plan.name === 'Growth' ? 'bg-emerald-100 text-emerald-600' :
                      'bg-amber-100 text-amber-600'
                    }`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <h4 className="font-bold text-slate-900">{plan.name}</h4>
                  </div>
                  <div className="mb-3">
                    <span className="text-3xl font-bold text-slate-900">₹{plan.price.toLocaleString()}</span>
                    <span className="text-xs text-slate-500">/{plan.period}</span>
                  </div>
                  <p className="text-xs text-slate-500 mb-4">{plan.description}</p>
                  <div className="space-y-1.5">
                    {plan.features.map((f) => (
                      <div key={f} className="flex items-center gap-2 text-xs">
                        <Check className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                        <span className="text-slate-700">{f}</span>
                      </div>
                    ))}
                    {plan.limitations.map((l) => (
                      <div key={l} className="flex items-center gap-2 text-xs">
                        <span className="h-3.5 w-3.5 flex-shrink-0 text-slate-300">—</span>
                        <span className="text-slate-400">{l}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </motion.div>

      {/* Active Subscriptions with Credits */}
      <motion.div variants={itemVariants}>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Active Subscriptions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {subscriptions.map((sub) => {
            const usagePercent = (sub.creditsUsed / sub.creditsTotal) * 100;
            return (
              <Card key={sub.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-slate-900">{sub.businessName}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={`text-[9px] h-4 ${
                          sub.plan === 'starter' ? 'bg-slate-100 text-slate-600' :
                          sub.plan === 'growth' ? 'bg-emerald-100 text-emerald-700' :
                          'bg-amber-100 text-amber-700'
                        }`} variant="secondary">
                          {sub.plan.charAt(0).toUpperCase() + sub.plan.slice(1)}
                        </Badge>
                        <Badge className={`text-[9px] h-4 ${statusColors[sub.status]}`} variant="secondary">
                          {sub.status}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm font-bold text-slate-900">
                      {sub.monthlyFee > 0 ? `₹${sub.monthlyFee.toLocaleString()}` : 'Free'}
                      <span className="text-[10px] text-slate-400 font-normal">/mo</span>
                    </p>
                  </div>

                  {/* Credit Usage */}
                  <div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                      <span>API Credits Used</span>
                      <span className="font-medium">{sub.creditsUsed} / {sub.creditsTotal}</span>
                    </div>
                    <Progress
                      value={usagePercent}
                      className="h-2"
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t">
                    <span>{sub.startDate} → {sub.endDate}</span>
                    <span>{sub.features.length} features</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}
