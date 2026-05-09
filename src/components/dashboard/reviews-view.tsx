'use client'

import { useState } from 'react'
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Star, TrendingUp, Bell, Heart,
} from 'lucide-react'

const stats = [
  { label: 'Avg Rating', value: '4.3', icon: Star, color: 'text-amber-600 bg-amber-50' },
  { label: 'Total Reviews', value: '1,847', icon: TrendingUp, color: 'text-blue-600 bg-blue-50' },
  { label: 'This Month', value: '142', icon: Bell, color: 'text-emerald-600 bg-emerald-50' },
  { label: 'Response Rate', value: '78%', icon: Heart, color: 'text-pink-600 bg-pink-50' },
]

const ratingDistribution = [
  { stars: 5, count: 842, percent: 46 },
  { stars: 4, count: 523, percent: 28 },
  { stars: 3, count: 258, percent: 14 },
  { stars: 2, count: 147, percent: 8 },
  { stars: 1, count: 77, percent: 4 },
]

const sentimentData = [
  { label: 'Positive', value: 72, color: 'bg-emerald-500', textColor: 'text-emerald-700', bgColor: 'bg-emerald-50' },
  { label: 'Neutral', value: 18, color: 'bg-amber-500', textColor: 'text-amber-700', bgColor: 'bg-amber-50' },
  { label: 'Negative', value: 10, color: 'bg-red-500', textColor: 'text-red-700', bgColor: 'bg-red-50' },
]

const reviews = [
  { id: 1, customer: 'Priya Sharma', rating: 5, text: 'Excellent quality produce! The organic vegetables are always fresh and well-packaged. Delivery was on time.', date: '2 hours ago', product: 'Organic Veggie Box', replied: false },
  { id: 2, customer: 'Amit Mehta', rating: 4, text: 'Good variety of products and competitive pricing. Would love to see more international brands added.', date: '5 hours ago', product: 'Basmati Rice 5kg', replied: true },
  { id: 3, customer: 'Neha Reddy', rating: 3, text: 'Average experience. Delivery was late by 30 minutes but the products were fine.', date: '1 day ago', product: 'Dairy Combo Pack', replied: true },
  { id: 4, customer: 'Vikram Desai', rating: 5, text: 'Best grocery delivery app! The real-time tracking is amazing and the app is very user-friendly.', date: '1 day ago', product: 'Fresh Fruits Bundle', replied: false },
  { id: 5, customer: 'Meera Iyer', rating: 2, text: 'Received damaged items twice. Packaging needs improvement. Customer support was helpful though.', date: '2 days ago', product: 'Glass Bottle Items', replied: true },
  { id: 6, customer: 'Rajesh Kumar', rating: 4, text: 'Great selection of organic products. The loyalty points system is a nice touch. Keeps me coming back!', date: '3 days ago', product: 'Organic Honey 500g', replied: false },
]

const topRatedProducts = [
  { name: 'Organic Veggie Box', rating: 4.8, reviews: 124, category: 'Organic' },
  { name: 'Fresh Fruits Bundle', rating: 4.7, reviews: 98, category: 'Fruits' },
  { name: 'Basmati Rice 5kg', rating: 4.6, reviews: 215, category: 'Grocery' },
  { name: 'A2 Milk 1L', rating: 4.6, reviews: 87, category: 'Dairy' },
  { name: 'Organic Honey 500g', rating: 4.5, reviews: 76, category: 'Organic' },
]

export function ReviewsView() {
  const [filterRating, setFilterRating] = useState<number | null>(null)

  const filteredReviews = filterRating
    ? reviews.filter(r => r.rating === filterRating)
    : reviews

  return (
    <div className="animate-in fade-in duration-300 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Customer Reviews</h2>
        <Badge variant="outline" className="text-[10px]">Last 30 days</Badge>
      </div>

      {/* Stats */}
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

      <div className="grid md:grid-cols-2 gap-4">
        {/* Rating Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Rating Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {ratingDistribution.map(r => (
                <div key={r.stars} className="flex items-center gap-2">
                  <span className="text-xs font-medium w-6 text-right">{r.stars}★</span>
                  <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-400 transition-all"
                      style={{ width: `${r.percent}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground w-16 text-right">{r.count} ({r.percent}%)</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-100">
              <div className="flex items-center">
                {[1, 2, 3, 4].map(i => (
                  <Star key={i} className="size-4 fill-amber-400 text-amber-400" />
                ))}
                <Star className="size-4 fill-amber-400/30 text-amber-400" />
              </div>
              <span className="text-sm font-bold">4.3</span>
              <span className="text-xs text-muted-foreground">out of 5</span>
            </div>
          </CardContent>
        </Card>

        {/* Sentiment Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Sentiment Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {sentimentData.map(s => (
                <div key={s.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-semibold ${s.textColor}`}>{s.label}</span>
                    <span className="text-xs font-bold">{s.value}%</span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${s.color} transition-all`}
                      style={{ width: `${s.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {sentimentData.map(s => (
                <div key={s.label} className={`p-2 rounded-lg text-center ${s.bgColor}`}>
                  <p className={`text-lg font-bold ${s.textColor}`}>{s.value}%</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter by Rating */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Recent Reviews</CardTitle>
            <div className="flex gap-1">
              <Button
                variant={filterRating === null ? 'default' : 'outline'}
                size="sm"
                className="text-[10px] h-6 px-2"
                onClick={() => setFilterRating(null)}
              >
                All
              </Button>
              {[5, 4, 3, 2, 1].map(r => (
                <Button
                  key={r}
                  variant={filterRating === r ? 'default' : 'outline'}
                  size="sm"
                  className="text-[10px] h-6 px-2"
                  onClick={() => setFilterRating(r)}
                >
                  {r}★
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {filteredReviews.map(rev => (
              <div key={rev.id} className="p-3 rounded-lg border">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{rev.customer}</span>
                      <Badge variant="outline" className="text-[10px]">{rev.product}</Badge>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`size-3 ${i < rev.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
                        />
                      ))}
                      <span className="text-[10px] text-muted-foreground ml-1">{rev.date}</span>
                    </div>
                  </div>
                  {rev.replied && (
                    <Badge className="text-[10px] bg-emerald-100 text-emerald-700">Replied</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{rev.text}</p>
                {!rev.replied && (
                  <Button variant="outline" size="sm" className="text-[10px] h-6 mt-2">
                    Reply
                  </Button>
                )}
              </div>
            ))}
            {filteredReviews.length === 0 && (
              <div className="text-center py-8 text-xs text-muted-foreground">
                No reviews with {filterRating}★ rating found.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Top Rated Products */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Top Rated Products</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {topRatedProducts.map((p, i) => (
              <div key={p.name} className="flex items-center gap-3 p-3 rounded-lg border">
                <span className="text-sm font-bold text-muted-foreground w-6">#{i + 1}</span>
                <div className="flex-1">
                  <p className="text-xs font-medium">{p.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-[10px]">{p.category}</Badge>
                    <span className="text-[10px] text-muted-foreground">{p.reviews} reviews</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Star className="size-3 fill-amber-400 text-amber-400" />
                  <span className="text-sm font-bold">{p.rating}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
