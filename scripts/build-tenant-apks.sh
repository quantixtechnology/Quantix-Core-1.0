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
# Newest build-tools available — apksigner and zipalign live here.
BT="$(ls -d "${ANDROID_HOME:-}"/build-tools/*/ 2>/dev/null | sort -V | tail -1)"
VERSION="${QUANTIX_APP_VERSION:-1.0.1}"
VERSION_CODE="${QUANTIX_APP_VERSION_CODE:-2}"

: "${JAVA_HOME:?set JAVA_HOME to a JDK 17 or 21}"
: "${ANDROID_HOME:?set ANDROID_HOME to the Android SDK}"

mkdir -p "$OUT"
echo "sdk.dir=$ANDROID_HOME" > "$WRAP/local.properties"

# The build configuration comes from the PLATFORM, not from this script.
#
# Hosts used to be composed here as <slug>.<base>, which is right only for a
# tenant who never brought a domain of their own — everyone else got an APK
# pointing at a hostname with no certificate on it. The app installed, opened,
# and failed on its first request. So the canonical host, the label, the Android
# id, the flavour and the icon are all read from the tenant's own configuration.
CONFIG_URL="$ICON_HOST/api/core/apk-build-config/$SLUG"
echo "Reading build configuration: $CONFIG_URL"
CONFIG="$(curl -fsS --max-time 60 "$CONFIG_URL")" || {
  echo "Could not read the build configuration for \"$SLUG\". Is the slug right, and is $ICON_HOST reachable?"
  exit 1
}

BUSINESS_NAME="$(printf '%s' "$CONFIG" | python3 -c 'import sys,json;print(json.load(sys.stdin)["businessName"])')"
echo "Tenant: $BUSINESS_NAME"

# key|url|label|packageId|flavour|iconPath — one line per app, straight from the
# platform. Nothing below invents any of it.
APPS=()
while IFS= read -r line; do APPS+=("$line"); done < <(printf '%s' "$CONFIG" | python3 -c '
import sys, json
for a in json.load(sys.stdin)["apps"]:
    print("|".join([a["key"], a["url"], a["label"], a["packageId"], a["flavour"], a["iconPath"]]))
')

for row in "${APPS[@]}"; do
  IFS='|' read -r key url label appId flavour iconPath <<<"$row"

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
    curl -fsS --max-time 60 "$ICON_HOST$iconPath" -o "$dir/ic_launcher.png"
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

  # Verify BEFORE publishing. An APK that does not verify is not a build
  # failure anyone sees — it is "There was a problem while parsing the package"
  # on somebody's phone, hours later and with nothing to go on. Checked here so
  # a broken artifact can never reach public/apks in the first place.
  "${BT}apksigner" verify "$built" >/dev/null || { echo "   SIGNATURE DID NOT VERIFY"; exit 1; }
  "${BT}zipalign" -c 4 "$built" >/dev/null || { echo "   APK IS NOT ALIGNED"; exit 1; }
  # Listed once and matched in the shell: `unzip -l | grep -q` looks right but
  # grep exits at the first hit, unzip dies of SIGPIPE, and pipefail then
  # reports a perfectly good APK as broken.
  listing="$(unzip -l "$built")"
  for entry in AndroidManifest.xml classes.dex resources.arsc; do
    case "$listing" in *"$entry"*) ;; *) echo "   APK IS MISSING $entry"; exit 1 ;; esac
  done

  cp "$built" "$OUT/$SLUG-$key.apk"
  echo "   → public/apks/$SLUG-$key.apk  ($(du -h "$OUT/$SLUG-$key.apk" | cut -f1), verified)"
done

echo
echo "Done. APKs in public/apks/"
