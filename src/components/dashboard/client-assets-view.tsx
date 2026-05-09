'use client'

import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Image, Building2, HardDrive, Globe, Upload, Eye,
  Download, Trash2, Palette, FileImage, FileVideo, FileText, File,
  LayoutGrid, Music,
} from 'lucide-react'

const stats = [
  { label: 'Total Assets', value: '48', icon: Image, color: 'text-slate-600 bg-slate-50' },
  { label: 'Businesses', value: '8', icon: Building2, color: 'text-emerald-600 bg-emerald-50' },
  { label: 'Storage', value: '2.4 GB', icon: HardDrive, color: 'text-blue-600 bg-blue-50' },
  { label: 'CDN Hits', value: '1.2M', icon: Globe, color: 'text-purple-600 bg-purple-50' },
]

const assetTypes = [
  { type: 'Logos', icon: Palette, count: 8, size: '12 MB' },
  { type: 'Banners', icon: LayoutGrid, count: 12, size: '340 MB' },
  { type: 'Product Images', icon: FileImage, count: 16, size: '1.8 GB' },
  { type: 'Icons', icon: Image, count: 24, size: '8 MB' },
  { type: 'Videos', icon: FileVideo, count: 3, size: '245 MB' },
  { type: 'Documents', icon: FileText, count: 6, size: '18 MB' },
  { type: 'Audio', icon: Music, count: 2, size: '15 MB' },
  { type: 'Other', icon: File, count: 5, size: '22 MB' },
]

const businessAssets = [
  { business: 'FreshMart', logo: true, banner: true, products: 42, theme: '#10B981', storage: '580 MB' },
  { business: 'CleanHome', logo: true, banner: true, products: 28, theme: '#3B82F6', storage: '420 MB' },
  { business: 'SpiceGarden', logo: true, banner: false, products: 35, theme: '#F59E0B', storage: '510 MB' },
  { business: 'TechHub', logo: true, banner: true, products: 18, theme: '#8B5CF6', storage: '320 MB' },
  { business: 'QuickWash', logo: false, banner: true, products: 12, theme: '#EC4899', storage: '280 MB' },
  { business: 'MediCare+', logo: true, banner: false, products: 8, theme: '#EF4444', storage: '190 MB' },
]

export function ClientAssetsView() {
  return (
    <div className="animate-in fade-in duration-300 space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(s => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${s.color}`}><s.icon className="size-4" /></div>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold">{s.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Asset Types</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {assetTypes.map(a => (
              <div key={a.type} className="p-3 rounded-lg border flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted"><a.icon className="size-4 text-muted-foreground" /></div>
                <div>
                  <p className="text-sm font-medium">{a.type}</p>
                  <p className="text-[10px] text-muted-foreground">{a.count} files · {a.size}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Business Assets</CardTitle>
            <Button variant="outline" size="sm" className="text-xs h-7"><Upload className="size-3 mr-1" />Upload</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium text-muted-foreground">Business</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Theme</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Logo</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Banner</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Products</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Storage</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {businessAssets.map(b => (
                  <tr key={b.business} className="border-b hover:bg-muted/50">
                    <td className="p-2 font-medium">{b.business}</td>
                    <td className="p-2"><div className="flex items-center gap-1"><div className="size-3 rounded-full border" style={{ backgroundColor: b.theme }} /><span className="font-mono text-muted-foreground">{b.theme}</span></div></td>
                    <td className="p-2"><Badge className={`text-[10px] ${b.logo ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{b.logo ? 'Yes' : 'Missing'}</Badge></td>
                    <td className="p-2"><Badge className={`text-[10px] ${b.banner ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{b.banner ? 'Yes' : 'Missing'}</Badge></td>
                    <td className="p-2">{b.products}</td>
                    <td className="p-2 text-muted-foreground">{b.storage}</td>
                    <td className="p-2">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0"><Eye className="size-3" /></Button>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0"><Download className="size-3" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Upload Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <Upload className="size-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-medium">Drag & drop files here</p>
            <p className="text-xs text-muted-foreground mt-1">PNG, JPG, SVG, MP4 — Max 50 MB per file</p>
            <Button variant="outline" size="sm" className="text-xs h-7 mt-3"><Upload className="size-3 mr-1" />Browse Files</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
