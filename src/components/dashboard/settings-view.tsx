'use client';

import { motion } from 'framer-motion';
import { Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const itemVariants = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.25 } } };

export function SettingsView() {
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {[
        { title: 'Business Configuration', items: ['Business Name', 'Contact Email', 'Contact Phone', 'GST Number', 'FSSAI License', 'Address'] },
        { title: 'Tax Settings (GST)', items: ['Default GST Rate', 'HSN Code', 'Inter-state IGST'] },
        { title: 'Delivery Settings', items: ['Default Delivery Radius', 'Delivery Fee', 'Free Delivery Above', 'Min Order Amount'] },
        { title: 'Payment Gateway', items: ['Razorpay Key ID', 'Razorpay Secret', 'Cash on Delivery', 'UPI Direct'] },
        { title: 'Notification Preferences', items: ['Email Notifications', 'WhatsApp Notifications', 'Push Notifications'] },
        { title: 'Branding', items: ['Primary Color', 'Logo', 'Favicon', 'Custom Domain'] },
      ].map(section => (
        <motion.div key={section.title} variants={itemVariants}>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">{section.title}</CardTitle></CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {section.items.map(item => (
                  <div key={item}>
                    <label className="text-[10px] text-slate-500 mb-1 block">{item}</label>
                    <Input className="h-8 text-xs" placeholder={item} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
      <Button className="bg-emerald-600 hover:bg-emerald-700 text-xs h-9"><Save className="h-3.5 w-3.5 mr-1.5" />Save Settings</Button>
    </motion.div>
  );
}
