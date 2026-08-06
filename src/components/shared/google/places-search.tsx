"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Loader2, Search, MapPin } from "lucide-react"
import { hasGoogleMapsKey, loadGoogleMaps } from "@/lib/google-maps"
import { fetchPlaceDetails, fetchPlaceSuggestions } from "@/lib/places"
import type { PlaceDetails, PlaceSuggestion } from "@/lib/places"

interface PlacesSearchProps {
  onSelect: (details: PlaceDetails) => void
  placeholder?: string
  autoFocus?: boolean
  icon?: "search" | "pin"
  inputClassName?: string
  containerClassName?: string
  disabled?: boolean
  onReadyChange?: (ready: boolean) => void
  onLoadingChange?: (loading: boolean) => void
  onError?: (message: string) => void
  minChars?: number
  debounceMs?: number
  country?: string
}

const MIN_CHARS = 3
const DEBOUNCE_MS = 300

/**
 * Google Places API (New) address search input. Replaces the legacy
 * `google.maps.places.Autocomplete` widget: fetches predictions with
 * `AutocompleteSuggestion.fetchAutocompleteSuggestions()` as the user types and
 * resolves the selected place with `Place.fetchFields()`. Supports keyboard
 * navigation (↑/↓/Enter/Escape), click selection, and emits the fully resolved
 * place (place ID, formatted address, lat/lng, viewport, address parts).
 */
export function PlacesSearch({
  onSelect,
  placeholder = "Search your delivery address",
  autoFocus = false,
  icon = "search",
  inputClassName = "",
  containerClassName = "",
  disabled = false,
  onReadyChange,
  onLoadingChange,
  onError,
  minChars = MIN_CHARS,
  debounceMs = DEBOUNCE_MS,
  country = "IN",
}: PlacesSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [mapsReady, setMapsReady] = useState(false)
  const [query, setQuery] = useState("")
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const googleRef = useRef<any>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const ready = hasGoogleMapsKey() && mapsReady

  useEffect(() => {
    if (!hasGoogleMapsKey()) return
    let mounted = true
    loadGoogleMaps()
      .then((google) => {
        if (!mounted) return
        googleRef.current = google
        setMapsReady(true)
        onReadyChange?.(true)
      })
      .catch(() => {
        if (mounted) {
          onReadyChange?.(false)
          onError?.("Could not load Google Maps.")
        }
      })
    return () => {
      mounted = false
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const q = query.trim()
    if (!ready || q.length < minChars) return
    debounceRef.current = setTimeout(async () => {
      const google = googleRef.current
      if (!google) return
      setLoading(true)
      onLoadingChange?.(true)
      try {
        const results = await fetchPlaceSuggestions(google, q, { country })
        setSuggestions(results)
        setActiveIndex(-1)
        setOpen(results.length > 0)
        setError("")
      } catch {
        setSuggestions([])
        setOpen(false)
        setError("Address search is unavailable. Type manually or use My Location.")
      } finally {
        setLoading(false)
        onLoadingChange?.(false)
      }
    }, debounceMs)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, ready, minChars, debounceMs, country, onLoadingChange])

  const resolve = useCallback(
    async (suggestion: PlaceSuggestion) => {
      const google = googleRef.current
      if (!google) return
      try {
        const details = await fetchPlaceDetails(google, suggestion.placeId)
        setQuery(details.formattedAddress ?? suggestion.primaryText)
        setOpen(false)
        setActiveIndex(-1)
        setError("")
        onSelect(details)
      } catch {
        setError("Could not resolve that address — try another suggestion.")
      }
    },
    [onSelect],
  )

  const scrollIntoView = (index: number) => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.scrollIntoView({ block: "nearest" })
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) {
      if (e.key === "Escape") setOpen(false)
      return
    }
    if (e.key === "ArrowDown") {
      e.preventDefault()
      const next = (activeIndex + 1) % suggestions.length
      setActiveIndex(next)
      scrollIntoView(next)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      const prev = (activeIndex - 1 + suggestions.length) % suggestions.length
      setActiveIndex(prev)
      scrollIntoView(prev)
    } else if (e.key === "Enter") {
      e.preventDefault()
      const idx = activeIndex >= 0 ? activeIndex : 0
      const suggestion = suggestions[idx]
      if (suggestion) void resolve(suggestion)
    } else if (e.key === "Escape") {
      e.preventDefault()
      setOpen(false)
      setActiveIndex(-1)
    }
  }

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    if (value.trim().length < minChars) {
      setSuggestions([])
      setOpen(false)
      setActiveIndex(-1)
      setError("")
    }
  }

  const Icon = icon === "pin" ? MapPin : Search

  return (
    <div className={`relative ${containerClassName}`}>
      {hasGoogleMapsKey() ? (
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      ) : null}
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={onInputChange}
        onKeyDown={onKeyDown}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        autoFocus={autoFocus}
        placeholder={placeholder}
        disabled={disabled || (hasGoogleMapsKey() && !mapsReady)}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls="places-search-list"
        className={`${inputClassName || "w-full pl-10 pr-3 h-11 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 bg-white disabled:opacity-50"} ${hasGoogleMapsKey() && !mapsReady ? "opacity-50" : ""}`}
      />
      {hasGoogleMapsKey() && !mapsReady && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <Loader2 className="w-4 h-4 animate-spin text-gray-300" />
        </div>
      )}
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <Loader2 className="w-4 h-4 animate-spin text-gray-300" />
        </div>
      )}
      {open && suggestions.length > 0 && (
        <ul
          id="places-search-list"
          ref={listRef}
          role="listbox"
          className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto rounded-xl border border-gray-100 bg-white shadow-lg"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.placeId}
              role="option"
              aria-selected={i === activeIndex}
              data-index={i}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                void resolve(s)
              }}
              className={`flex items-start gap-2 px-3 py-2.5 cursor-pointer text-sm ${i === activeIndex ? "bg-gray-50" : "bg-white"}`}
            >
              <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" />
              <div className="min-w-0">
                <p className="text-gray-900 truncate">{s.primaryText}</p>
                {s.secondaryText && <p className="text-gray-400 text-xs truncate">{s.secondaryText}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
