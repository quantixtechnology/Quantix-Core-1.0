'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Package, Zap, Users, Shield, CreditCard, Globe, Smartphone, Settings } from 'lucide-react'

interface ProductDetailsViewProps {
  productCode: string
}

export function ProductDetailsView({ productCode }: ProductDetailsViewProps) {
  const [activeTab, setActiveTab] = useState('general')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Package className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold">Product Management</h1>
          <p className="text-gray-600">Manage product configuration, features, and settings</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="features">
            <Zap className="h-4 w-4 mr-1" />
            Features
          </TabsTrigger>
          <TabsTrigger value="roles">
            <Users className="h-4 w-4 mr-1" />
            Roles
          </TabsTrigger>
          <TabsTrigger value="permissions">
            <Shield className="h-4 w-4 mr-1" />
            Permissions
          </TabsTrigger>
          <TabsTrigger value="plans">
            <CreditCard className="h-4 w-4 mr-1" />
            Plans
          </TabsTrigger>
          <TabsTrigger value="website">
            <Globe className="h-4 w-4 mr-1" />
            Website
          </TabsTrigger>
          <TabsTrigger value="apps">
            <Smartphone className="h-4 w-4 mr-1" />
            Apps
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4 mr-1" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>Product Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-600">Product Name</label>
                  <p className="text-lg font-medium">Loading...</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-600">Product Code</label>
                  <p className="text-lg font-medium">{productCode}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-600">Current Version</label>
                  <p className="text-lg font-medium">Loading...</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-600">Status</label>
                  <Badge className="mt-2">ACTIVE</Badge>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-semibold text-gray-600">Description</label>
                  <p className="text-gray-700 mt-1">Loading...</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Features Tab */}
        <TabsContent value="features">
          <Card>
            <CardHeader>
              <CardTitle>Feature Catalog</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Core Features (Required)</h3>
                  <div className="grid grid-cols-3 gap-2">
                    <Badge variant="default">Feature 1</Badge>
                    <Badge variant="default">Feature 2</Badge>
                    <Badge variant="default">Feature 3</Badge>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Advanced Features (Optional)</h3>
                  <div className="grid grid-cols-3 gap-2">
                    <Badge variant="secondary">Feature A</Badge>
                    <Badge variant="secondary">Feature B</Badge>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Premium Features (Optional)</h3>
                  <div className="grid grid-cols-3 gap-2">
                    <Badge variant="outline">Feature X</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Roles Tab */}
        <TabsContent value="roles">
          <Card>
            <CardHeader>
              <CardTitle>Default Roles</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm text-gray-600 mb-4">
                  These are default roles for this product. Businesses can override role definitions during
                  business creation.
                </p>
                <div className="border rounded-lg divide-y">
                  <div className="p-4">
                    <h4 className="font-semibold">Role Name</h4>
                    <p className="text-sm text-gray-600">Description</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Permissions Tab */}
        <TabsContent value="permissions">
          <Card>
            <CardHeader>
              <CardTitle>Default Permissions by Role</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                These are default permissions assigned to each role. Businesses can customize during setup.
              </p>
              <div className="border rounded-lg">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-3 font-semibold">Role</th>
                      <th className="text-left p-3 font-semibold">Permissions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="p-3">Owner</td>
                      <td className="p-3 text-sm">All permissions</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Plans Tab */}
        <TabsContent value="plans">
          <Card>
            <CardHeader>
              <CardTitle>Subscription Plans</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {['STARTER', 'PROFESSIONAL', 'ENTERPRISE'].map((plan) => (
                  <div key={plan} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold">{plan}</h4>
                        <p className="text-sm text-gray-600">Plan description</p>
                      </div>
                      {plan === 'STARTER' && <Badge>Default</Badge>}
                    </div>
                    <div className="grid grid-cols-4 gap-4 mt-3 text-sm">
                      <div>
                        <p className="text-gray-600">Storage</p>
                        <p className="font-semibold">10 GB</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Users</p>
                        <p className="font-semibold">5</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Branches</p>
                        <p className="font-semibold">1</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Price</p>
                        <p className="font-semibold">$X/mo</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Website Tab */}
        <TabsContent value="website">
          <Card>
            <CardHeader>
              <CardTitle>Website Template</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-600">Template Name</label>
                <p className="mt-1">Store Website</p>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-600">Included Pages</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {['Home', 'Products', 'Categories', 'Cart', 'Orders'].map((page) => (
                    <Badge key={page} variant="secondary">
                      {page}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-600">Default Theme</label>
                <div className="grid grid-cols-3 gap-4 mt-2">
                  <div>
                    <p className="text-sm text-gray-600">Primary Color</p>
                    <div className="h-8 w-8 bg-blue-500 rounded mt-1"></div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Secondary Color</p>
                    <div className="h-8 w-8 bg-gray-500 rounded mt-1"></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Apps Tab */}
        <TabsContent value="apps">
          <Card>
            <CardHeader>
              <CardTitle>Mobile Applications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {['Customer App', 'Delivery App', 'Admin App'].map((app) => (
                <div key={app} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="font-semibold">{app}</h4>
                    <Badge variant="outline">Ready</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Version</p>
                      <p className="font-semibold">2.1.0</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Play Store</p>
                      <p className="text-blue-600">View</p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Default Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-600">Default Currency</label>
                  <p className="mt-1">INR</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-600">Default Timezone</label>
                  <p className="mt-1">Asia/Kolkata</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-600">Order Prefix</label>
                  <p className="mt-1">ORD</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-600">Invoice Prefix</label>
                  <p className="mt-1">INV</p>
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-600">Notification Defaults</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge>Email</Badge>
                  <Badge>SMS</Badge>
                  <Badge>Push Notifications</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
