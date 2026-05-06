'use client';

import { motion } from 'framer-motion';
import { Save, Store, Receipt, MapPin, CreditCard, Bell, Globe, Palette } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

export function SettingsView() {
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Settings</h2>
          <p className="text-sm text-slate-500">Configure your business and platform preferences</p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700 text-xs h-9">
          <Save className="h-3.5 w-3.5 mr-2" />
          Save Changes
        </Button>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Business Configuration */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4 text-emerald-600" />
                <CardTitle className="text-sm">Business Configuration</CardTitle>
              </div>
              <CardDescription className="text-xs">Basic business information and branding</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Business Name</Label>
                  <Input defaultValue="FreshMart Groceries" className="h-9 text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Business Type</Label>
                  <Input defaultValue="Grocery" className="h-9 text-xs" disabled />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Email</Label>
                  <Input defaultValue="rajesh@freshmart.in" className="h-9 text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Phone</Label>
                  <Input defaultValue="+91 98765 43210" className="h-9 text-xs" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Address</Label>
                <Textarea defaultValue="123 MG Road, Andheri West, Mumbai" className="text-xs min-h-[60px]" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">GST Number</Label>
                <Input defaultValue="27AABCU9603R1ZM" className="h-9 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Business Logo</Label>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600 text-xs font-bold">
                    FM
                  </div>
                  <Button variant="outline" size="sm" className="text-xs h-8">Upload Logo</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Tax Settings */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-emerald-600" />
                <CardTitle className="text-sm">Tax Settings (GST)</CardTitle>
              </div>
              <CardDescription className="text-xs">Configure GST rates for products and services</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {[
                  { label: 'Essentials (Grains, Salt, etc.)', rate: '0%', hsn: '1001-1006' },
                  { label: 'Food Products (Prepared meals)', rate: '5%', hsn: '2106' },
                  { label: 'Packaged Food (Snacks, Beverages)', rate: '12%', hsn: '2101-2105' },
                  { label: 'Dairy Products (Butter, Cheese)', rate: '12%', hsn: '0405' },
                  { label: 'Services (Laundry, Car Wash)', rate: '18%', hsn: '9963-9967' },
                  { label: 'Home Services', rate: '18%', hsn: '9954' },
                  { label: 'Subscription Fee (SaaS)', rate: '18%', hsn: '9983' },
                ].map((tax) => (
                  <div key={tax.label} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                    <div>
                      <p className="text-xs font-medium text-slate-700">{tax.label}</p>
                      <p className="text-[10px] text-slate-400">HSN: {tax.hsn}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] h-5 border-emerald-200 text-emerald-700">
                      GST {tax.rate}
                    </Badge>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <Switch defaultChecked id="inclusive-tax" />
                <Label htmlFor="inclusive-tax" className="text-xs text-slate-600">Prices are GST inclusive</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch id="show-hsn" />
                <Label htmlFor="show-hsn" className="text-xs text-slate-600">Show HSN code on invoices</Label>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Delivery Zone Config */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-emerald-600" />
                <CardTitle className="text-sm">Delivery Zone Configuration</CardTitle>
              </div>
              <CardDescription className="text-xs">Set delivery zones, fees, and timing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Default Delivery Radius</Label>
                  <Input defaultValue="5" type="number" className="h-9 text-xs" />
                  <p className="text-[10px] text-slate-400">In kilometers</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Base Delivery Fee</Label>
                  <Input defaultValue="40" type="number" className="h-9 text-xs" />
                  <p className="text-[10px] text-slate-400">In INR</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Per Km Charge</Label>
                  <Input defaultValue="8" type="number" className="h-9 text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Free Delivery Above</Label>
                  <Input defaultValue="500" type="number" className="h-9 text-xs" />
                  <p className="text-[10px] text-slate-400">Order amount (INR)</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Peak Hour Surcharge</Label>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-slate-400">Start</Label>
                    <Input defaultValue="18:00" type="time" className="h-9 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-slate-400">End</Label>
                    <Input defaultValue="22:00" type="time" className="h-9 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-slate-400">Surge %</Label>
                    <Input defaultValue="20" type="number" className="h-9 text-xs" />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch defaultChecked id="multi-zone" />
                <Label htmlFor="multi-zone" className="text-xs text-slate-600">Enable multi-zone delivery</Label>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Payment Gateway */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-emerald-600" />
                <CardTitle className="text-sm">Payment Gateway</CardTitle>
              </div>
              <CardDescription className="text-xs">Configure payment methods and gateway keys</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center text-xs font-bold text-blue-700">RZ</div>
                    <div>
                      <p className="text-xs font-medium text-slate-700">Razorpay</p>
                      <p className="text-[10px] text-slate-400">UPI, Cards, Wallets</p>
                    </div>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-violet-100 rounded flex items-center justify-center text-xs font-bold text-violet-700">ST</div>
                    <div>
                      <p className="text-xs font-medium text-slate-700">Stripe</p>
                      <p className="text-[10px] text-slate-400">International Cards</p>
                    </div>
                  </div>
                  <Switch />
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label className="text-xs">Razorpay Key ID</Label>
                <Input defaultValue="rzp_live_••••••••" className="h-9 text-xs" type="password" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Razorpay Key Secret</Label>
                <Input defaultValue="••••••••••••••••" className="h-9 text-xs" type="password" />
              </div>
              <div className="flex items-center gap-3">
                <Switch defaultChecked id="cash-payment" />
                <Label htmlFor="cash-payment" className="text-xs text-slate-600">Accept Cash on Delivery</Label>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Notification Preferences */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-emerald-600" />
                <CardTitle className="text-sm">Notification Preferences</CardTitle>
              </div>
              <CardDescription className="text-xs">Configure when and how you receive notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: 'New Order Alerts', desc: 'Get notified for every new order', on: true },
                { label: 'Low Stock Alerts', desc: 'When product stock falls below threshold', on: true },
                { label: 'Delivery Updates', desc: 'Real-time delivery status changes', on: true },
                { label: 'Payment Notifications', desc: 'Successful/failed payment alerts', on: true },
                { label: 'Subscription Reminders', desc: 'Upcoming renewal and expiry', on: false },
                { label: 'Daily Reports', desc: 'Daily sales summary at 10 PM', on: false },
                { label: 'Weekly Analytics', desc: 'Weekly performance report email', on: true },
              ].map((notif) => (
                <div key={notif.label} className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-700">{notif.label}</p>
                    <p className="text-[10px] text-slate-400">{notif.desc}</p>
                  </div>
                  <Switch defaultChecked={notif.on} />
                </div>
              ))}
              <Separator />
              <div className="space-y-2">
                <Label className="text-xs">Notification Channels</Label>
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-[10px] h-6 border-emerald-200 text-emerald-700 bg-emerald-50">✓ Email</Badge>
                  <Badge variant="outline" className="text-[10px] h-6 border-emerald-200 text-emerald-700 bg-emerald-50">✓ Push</Badge>
                  <Badge variant="outline" className="text-[10px] h-6 border-slate-200 text-slate-500">✗ SMS</Badge>
                  <Badge variant="outline" className="text-[10px] h-6 border-emerald-200 text-emerald-700 bg-emerald-50">✓ WhatsApp</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Domain & Branding */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-emerald-600" />
                <CardTitle className="text-sm">Domain & Branding</CardTitle>
              </div>
              <CardDescription className="text-xs">Custom domain and white-label settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">Custom Domain</Label>
                <Input defaultValue="shop.freshmart.in" className="h-9 text-xs" />
                <p className="text-[10px] text-slate-400">CNAME record: shop.freshmart.in → quantix.app</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Storefront URL</Label>
                <div className="flex items-center gap-2">
                  <Input defaultValue="freshmart" className="h-9 text-xs" />
                  <span className="text-xs text-slate-400">.quantix.app</span>
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label className="text-xs">Primary Brand Color</Label>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600" />
                  <Input defaultValue="#10B981" className="h-9 text-xs max-w-[120px]" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch id="white-label" />
                <Label htmlFor="white-label" className="text-xs text-slate-600">Enable white-label (remove Quantix branding)</Label>
              </div>
              <p className="text-[10px] text-amber-600">⚠️ White-label requires Enterprise plan</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
