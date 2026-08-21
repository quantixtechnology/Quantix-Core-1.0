#!/usr/bin/env bash
# Build installable APKs for one tenant's PWAs.
#
#   scripts/build-tenant-apks.sh <tenantSlug> [baseDomain]
#
# Nothing about a tenant lives in the Android project: the slug, launch URLs,
# app names, package ids and icons are all passed in here, so the same source
# builds every app for every business.
#
# Icons come from the app's OWN branding — /api/core/app-icon/<slug>/<app> —
# so the launcher icon is the one configured in Mobile Apps → App Branding.
#
# Signing comes from the environment and is never committed:
#   QUANTIX_KEYSTORE_PATH QUANTIX_KEYSTORE_PASSWORD QUANTIX_KEY_ALIAS QUANTIX_KEY_PASSWORD
set -euo pipefail

SLUG="${1:?tenant slug required}"
BASE="${2:-quantixtechnology.in}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WRAP="$ROOT/android-wrapper"
OUT="$ROOT/public/apks"
ICON_HOST="${QUANTIX_ICON_HOST:-https://app.$BASE}"
VERSION="${QUANTIX_APP_VERSION:-1.0.0}"
VERSION_CODE="${QUANTIX_APP_VERSION_CODE:-1}"

: "${JAVA_HOME:?set JAVA_HOME to a JDK 17 or 21}"
: "${ANDROID_HOME:?set ANDROID_HOME to the Android SDK}"

mkdir -p "$OUT"
echo "sdk.dir=$ANDROID_HOME" > "$WRAP/local.properties"

# app-key | launch host | display name | package suffix | branding key | flavour
#
# The flavour decides whether the app may open a camera at all: `scanner`
# declares CAMERA, `viewer` does not declare it anywhere. Delivery scans bag
# QRs and Store scans garments and bags; the Customer app never scans.
APPS=(
  "customer|$SLUG.$BASE|Laundry Customer|customer|customer|viewer"
  "delivery|delivery.$SLUG.$BASE|Laundry Delivery|delivery|delivery|scanner"
  "store|store.$SLUG.$BASE|Laundry Store|store|store|scanner"
)

for row in "${APPS[@]}"; do
  IFS='|' read -r key host label pkg brand flavour <<<"$row"
  url="https://$host/"
  appId="in.quantixtechnology.laundry.$pkg.$(echo "$SLUG" | tr -cd '[:alnum:]')"

  echo "── $label"
  echo "   url     $url"
  echo "   package $appId"
  echo "   camera  $([ "$flavour" = scanner ] && echo yes || echo no)"

  # Launcher icon = this app's configured branding icon, at each density.
  # Failing to fetch is fatal: shipping the wrong icon is worse than stopping.
  for d in "mdpi 48" "hdpi 72" "xhdpi 96" "xxhdpi 144" "xxxhdpi 192"; do
    set -- $d
    dir="$WRAP/app/src/main/res/mipmap-$1"
    mkdir -p "$dir"
    curl -fsS --max-time 60 "$ICON_HOST/api/core/app-icon/$SLUG/$brand/192.png" -o "$dir/ic_launcher.png"
  done

  task="assemble$(echo "${flavour:0:1}" | tr '[:lower:]' '[:upper:]')${flavour:1}Release"
  ( cd "$WRAP" && ./gradlew --no-daemon -q "$task" \
      -PquantixAppId="$appId" \
      -PquantixAppLabel="$label" \
      -PquantixLaunchUrl="$url" \
      -PquantixVersion="$VERSION" \
      -PquantixVersionCode="$VERSION_CODE" )

  built="$WRAP/app/build/outputs/apk/$flavour/release/app-$flavour-release.apk"
  [ -f "$built" ] || { echo "   BUILD PRODUCED NO APK"; exit 1; }
  cp "$built" "$OUT/$SLUG-$key.apk"
  echo "   → public/apks/$SLUG-$key.apk  ($(du -h "$OUT/$SLUG-$key.apk" | cut -f1))"
done

echo
echo "Done. APKs in public/apks/"
