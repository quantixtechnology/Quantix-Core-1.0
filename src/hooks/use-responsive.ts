"use client"

import { useState, useEffect, useCallback } from "react"
import { debounce } from "@/lib/performance"

const MOBILE_BREAKPOINT = 640
const TABLET_BREAKPOINT = 1024
const SMALL_MOBILE_BREAKPOINT = 380

interface ResponsiveState {
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  isSmallMobile: boolean
  screenWidth: number
  screenHeight: number
  orientation: "portrait" | "landscape"
}

/**
 * Hook to detect responsive breakpoints and screen properties.
 * Returns current responsive state based on screen dimensions.
 */
export function useResponsive(): ResponsiveState {
  const [state, setState] = useState<ResponsiveState>({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isSmallMobile: false,
    screenWidth: 1024,
    screenHeight: 768,
    orientation: "landscape",
  })

  useEffect(() => {
    const updateState = () => {
      const width = window.innerWidth
      const height = window.innerHeight

      setState({
        isMobile: width < MOBILE_BREAKPOINT,
        isTablet: width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT,
        isDesktop: width >= TABLET_BREAKPOINT,
        isSmallMobile: width < SMALL_MOBILE_BREAKPOINT,
        screenWidth: width,
        screenHeight: height,
        orientation: width >= height ? "landscape" : "portrait",
      })
    }

    updateState()

    const debouncedUpdate = debounce(updateState, 150)
    window.addEventListener("resize", debouncedUpdate)

    return () => {
      window.removeEventListener("resize", debouncedUpdate)
    }
  }, [])

  return state
}

/**
 * Debounced resize hook that calls a callback with the current width and height.
 * Uses the debounce utility from performance.ts for optimized resize handling.
 */
export function useDebouncedResize(
  callback: (width: number, height: number) => void,
  delay: number = 150
): void {
  const handleResize = useCallback(() => {
    callback(window.innerWidth, window.innerHeight)
  }, [callback])

  useEffect(() => {
    const debouncedHandler = debounce(handleResize, delay)

    // Call once on mount
    handleResize()

    window.addEventListener("resize", debouncedHandler)
    return () => {
      window.removeEventListener("resize", debouncedHandler)
    }
  }, [handleResize, delay])
}

/**
 * Detect if the user is on a touch-enabled device.
 * Uses multiple detection methods for reliability.
 */
export function useIsTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState(false)

  useEffect(() => {
    const checkTouch = () => {
      // Check for touch events support
      const hasTouchEvents = "ontouchstart" in window || navigator.maxTouchPoints > 0
      // Check for coarse pointer (touch/pen)
      const hasCoarsePointer = window.matchMedia("(pointer: coarse)").matches
      // Check for hover capability (touch devices typically have none)
      const hasNoHover = window.matchMedia("(hover: none)").matches

      setIsTouch(hasTouchEvents || hasCoarsePointer || hasNoHover)
    }

    checkTouch()
  }, [])

  return isTouch
}
