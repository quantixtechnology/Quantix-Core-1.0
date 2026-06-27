// Commerce Product Layout
// Entry point for all Commerce OS features

import { ReactNode } from 'react'

export const metadata = {
  title: 'Commerce OS | Quantix',
  description: 'Commerce management platform',
}

interface CommerceLayoutProps {
  children: ReactNode
}

export default function CommerceLayout({ children }: CommerceLayoutProps) {
  return (
    <div className="commerce-app">
      {/* Commerce Product wrapper */}
      {children}
    </div>
  )
}
