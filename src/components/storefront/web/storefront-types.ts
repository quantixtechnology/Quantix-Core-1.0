export type WebPage =
  | "home"
  | "category"
  | "product"
  | "auth"
  | "checkout"
  | "order-tracking"
  | "orders"
  | "profile"
  | "addresses"
  | "password"

export interface WebNav {
  go: (page: WebPage, opts?: {
    categoryId?: string
    categoryName?: string
    productId?: string
    orderId?: string
  }) => void
  goBack: (defaultPage?: WebPage) => void
  canGoBack: boolean
  current: WebPage
  categoryId: string | null
  categoryName: string
  productId: string | null
  orderId: string | null
  prevPage: WebPage | null
}
