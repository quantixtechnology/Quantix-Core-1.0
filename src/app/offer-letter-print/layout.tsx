// Standalone layout for Offer Letter print pages.
// Deliberately minimal — no AuthProvider, no admin nav, no Toaster.
// This route opens in a new tab; inheriting the root AuthProvider would mean
// any 401 handling here could fire StorageEvents that log out the parent tab.
export default function OfferLetterPrintLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
