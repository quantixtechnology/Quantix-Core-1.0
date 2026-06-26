// Server component that initializes platform on render
// Runs once per server restart
import { initializePlatform } from '@/lib/platform-init'

export async function PlatformInitializer() {
  try {
    await initializePlatform()
  } catch (error) {
    console.error('[PLATFORM INITIALIZER] Failed to initialize:', error)
  }

  return null
}
