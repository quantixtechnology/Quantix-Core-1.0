import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { garmentLabel } from '@/components/laundry/garment-select'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const SELECTOR = read('src/components/laundry/garment-select.tsx')
const AUDIT = read('src/components/laundry/views/laundry-store-audit.tsx')
const NEW_ORDER = read('src/components/laundry/views/laundry-new-order.tsx')

describe('one garment master, one selector', () => {
  it('the selector reads the master endpoint', () => {
    expect(SELECTOR).toContain('/api/laundry/garments?businessId=')
  })

  // A retired garment must not start new work, but must still render on old
  // orders — which is why only the admin master passes includeInactive.
  it('operational selection never asks for inactive garments', () => {
    // The comment explains the choice; what matters is the request URL.
    const url = SELECTOR.slice(SELECTOR.indexOf('fetch(`/api/laundry/garments'), SELECTOR.indexOf('.then'))
    expect(url).not.toContain('includeInactive')
  })

  it('Store Audit uses the shared selector, not its own list', () => {
    expect(AUDIT).toContain('<LaundryGarmentSelect')
    expect(AUDIT).toContain('useGarmentMaster(businessId)')
    expect(AUDIT).not.toMatch(/garments\.map\(\(g\) => <option/)
  })

  it('New Order uses the same component', () => {
    expect(NEW_ORDER).toContain('<LaundryGarmentSelect')
    expect(NEW_ORDER).not.toMatch(/options=\{garments\.map/)
  })

  it('search covers the code as well as the name', () => {
    expect(garmentLabel({ id: '1', name: 'Shirt', code: 'G-SHRT2' })).toBe('Shirt · G-SHRT2')
    expect(garmentLabel({ id: '2', name: 'Towel' })).toBe('Towel')
  })

  it('a garment with no code still selects cleanly', () => {
    expect(garmentLabel({ id: '3', name: 'Mixed Wash', code: null })).toBe('Mixed Wash')
  })
})

// The regression that prompted this: a screen shipping its own garment names.
describe('no operational screen hardcodes garment names', () => {
  const OPERATIONAL = [
    'src/components/laundry/views/laundry-store-audit.tsx',
    'src/components/laundry/views/laundry-new-order.tsx',
    'src/components/laundry/garment-select.tsx',
  ]
  for (const f of OPERATIONAL) {
    it(f, () => {
      const src = read(f)
      for (const name of ['Helmet', 'Soft Toy', 'Leather Jacket', 'Saree', 'Blazer']) {
        expect(src).not.toContain(`"${name}"`)
      }
    })
  }
})
