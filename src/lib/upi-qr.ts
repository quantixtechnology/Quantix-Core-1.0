export interface UpiQrParams {
  pa: string
  pn?: string
  am?: number
  tn?: string
  cu?: string
}

export function buildUpiUri(params: UpiQrParams): string {
  const query = new URLSearchParams()
  query.set('pa', params.pa)
  if (params.pn) query.set('pn', params.pn)
  if (params.am != null) query.set('am', String(params.am))
  if (params.tn) query.set('tn', params.tn)
  query.set('cu', params.cu || 'INR')
  return `upi://pay?${query.toString()}`
}
