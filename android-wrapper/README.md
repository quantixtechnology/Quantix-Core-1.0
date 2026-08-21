# Android wrappers

One source tree that builds an installable APK around any one of the tenant
PWAs. There is no second app here: the web app IS the app, and everything in
`MainActivity` exists to get out of its way.

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME="$HOME/Library/Android/sdk"

export QUANTIX_KEYSTORE_PATH="$HOME/.quantix-android/quantix-release.jks"
export QUANTIX_KEYSTORE_PASSWORD='…'
export QUANTIX_KEY_ALIAS=quantix
export QUANTIX_KEY_PASSWORD="$QUANTIX_KEYSTORE_PASSWORD"

scripts/build-tenant-apks.sh <tenant-slug> [base-domain]
```

Output lands in `public/apks/<slug>-{customer,delivery,store}.apk`, which is
where the Mobile Apps screen looks for it — the Download APK button is enabled
by the file existing, not by a build service reporting success.

## What is parameterised

Nothing about a tenant is committed. The slug, launch URL, app name, package id,
version and launcher icon all arrive at build time; the icon is fetched from
`/api/core/app-icon/<slug>/<app>/192.png`, the same route the PWA manifest
points at, so the installed icon and the one in the admin screen cannot drift.

Package ids are `in.quantixtechnology.laundry.<app>.<tenant>` so two tenants can
have "the delivery app" installed on one phone.

## Camera

`viewer` and `scanner` are the two product flavours. `scanner` merges
`src/scanner/AndroidManifest.xml`, which is the only place `CAMERA` is declared;
Delivery and Store build as `scanner`, Customer as `viewer` and never asks for a
camera at all.

Declaring it is not granting it. When the page calls `getUserMedia`, the shell
grants `RESOURCE_VIDEO_CAPTURE` alone — never `request.getResources()`, which
would hand over the microphone too — asking Android for the runtime permission
first if it does not already hold it, and denying (rather than ignoring) a
refusal so the page's own error path runs.

## What makes it installable

`minSdk 21` (Android 5.0), no native code, so there is no device the package is
too new or the wrong shape for. Signed with **v1, v2 and v3** — AGP drops v1
above minSdk 24, which leaves `META-INF` empty; the platform accepts that, but
OEM package installers and file managers still look there, and what they cannot
find they refuse.

The builder verifies every APK — signature, alignment, and the presence of
`AndroidManifest.xml`, `classes.dex` and `resources.arsc` — **before** copying
it into `public/apks`. A bad artifact does not surface as a build failure; it
surfaces as "There was a problem while parsing the package" on somebody's
phone, hours later, with nothing to go on.

## Signing

The release keystore is **not** in this repo and must not be. It lives outside
the working tree and is referenced through the four `QUANTIX_*` environment
variables above; `*.jks` and `*.keystore` are gitignored.

Losing it means future versions cannot install over the current ones without
users uninstalling first, so it needs an out-of-band backup.
