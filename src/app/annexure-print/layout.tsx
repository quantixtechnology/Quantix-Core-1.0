// Deliberately minimal — no AuthProvider, no admin nav.
// The annexure print page handles its own auth via silentFailure authFetch.
export default function AnnexurePrintLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
