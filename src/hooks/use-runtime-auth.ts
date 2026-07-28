"use client"

import { useContext } from "react"
import { RuntimeAuthContext } from "@/components/auth/runtime-auth-provider"
import type { RuntimeAuth } from "@/lib/runtime-auth"
import { UNAUTHORIZED } from "@/lib/runtime-auth"

export function useRuntimeAuth(): RuntimeAuth {
  return useContext(RuntimeAuthContext)
}
