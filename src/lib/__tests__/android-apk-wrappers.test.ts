import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// Three installable Android apps out of one source tree.
//
// The PWAs were only installable through Chrome's own flow, which not every
// executive finds and no customer should have to. These are real signed APKs
// that wrap the same URLs — so nothing about the web apps changed, and there is
// no second implementation of anything to keep in step.
//
// What the wrapper must NOT become is an app that asks for everything. The
// Delivery and Store apps scan QR codes and so declare CAMERA; the Customer app
// does not scan and does not declare it. When the page asks for a camera the
// shell grants exactly that one resource, never the whole list.
// ============================================================================

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const GRADLE   = read('android-wrapper/app/build.gradle')
const MANIFEST = read('android-wrapper/app/src/main/AndroidManifest.xml')
const SCANNER  = read('android-wrapper/app/src/scanner/AndroidManifest.xml')
const ACTIVITY = read('android-wrapper/app/src/main/java/in/quantixtechnology/wrapper/MainActivity.java')
const SCRIPT   = read('scripts/build-tenant-apks.sh')
const ARTIFACTS = read('src/lib/mobile-apk-artifacts.ts')
const ROUTE    = read('src/app/api/laundry/app-provisioning/route.ts')
const GITIGNORE = read('.gitignore')
const PROXY    = read('src/proxy.ts')

/**
 * Both files EXPLAIN the mistakes they avoid, in comments that quote them
 * verbatim. An absence assertion has to read the code, or it fails on the
 * sentence describing why the code is the way it is.
 */
const codeOnly = (src: string) =>
  src.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

describe('only the apps that scan may open a camera', () => {
  it('the base manifest declares no camera at all', () => {
    // An app that asks for a camera it never opens is one people are right to
    // distrust — and the Customer app never scans anything.
    expect(MANIFEST).toContain('android.permission.INTERNET')
    expect(codeOnly(MANIFEST)).not.toContain('android.permission.CAMERA')
  })

  it('the camera lives in a flavour overlay', () => {
    expect(SCANNER).toContain('android.permission.CAMERA')
    expect(SCANNER).toContain('android:name="android.hardware.camera" android:required="false"')
    expect(GRADLE).toContain('productFlavors')
    expect(GRADLE).toContain('viewer  { dimension "capability" }')
    expect(GRADLE).toContain('scanner { dimension "capability" }')
  })

  it('a missing camera does not block installation', () => {
    // required="false", so a scanner build still installs on a device without
    // one and simply fails at the scan instead of at the Play listing.
    expect(SCANNER).toContain('android:required="false"')
  })

  it('the builder gives each app the right flavour', () => {
    expect(SCRIPT).toContain('"customer|$SLUG.$BASE|Laundry Customer|customer|customer|viewer"')
    expect(SCRIPT).toContain('"delivery|delivery.$SLUG.$BASE|Laundry Delivery|delivery|delivery|scanner"')
    expect(SCRIPT).toContain('"store|store.$SLUG.$BASE|Laundry Store|store|store|scanner"')
  })

  it('a manifest placeholder is not used for it', () => {
    // tools:node="${...}" fails the build outright: the merger reads the node
    // operation before placeholders are substituted.
    expect(codeOnly(MANIFEST)).not.toContain('tools:node')
    expect(codeOnly(SCANNER)).not.toContain('tools:node')
  })
})

describe('the shell forwards a camera grant, and nothing else', () => {
  it('it grants only the video resource the page asked for', () => {
    expect(ACTIVITY).toContain('PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)')
    expect(ACTIVITY).toContain('request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE})')
  })

  it('anything else is denied outright', () => {
    // grant(request.getResources()) hands over the microphone and protected
    // media the moment a page asks for a camera.
    expect(codeOnly(ACTIVITY)).not.toContain('request.grant(request.getResources())')
    expect(ACTIVITY).toContain('request.deny()')
  })

  it('the Android permission is asked for before the web one is answered', () => {
    expect(ACTIVITY).toContain('Manifest.permission.CAMERA')
    expect(ACTIVITY).toContain('pendingWebRequest = request')
    expect(ACTIVITY).toContain('new String[]{Manifest.permission.CAMERA}, REQ_CAMERA)')
  })

  it('a refusal is answered, never left hanging', () => {
    // An unanswered PermissionRequest leaves getUserMedia pending forever, so
    // the scan screen spins instead of showing its own error.
    expect(ACTIVITY).toContain('pendingWebRequest.deny()')
    expect(ACTIVITY).toContain('pendingWebRequest = null')
  })

  it('the app stays on its own tenant host', () => {
    expect(ACTIVITY).toContain('Uri.parse(BuildConfig.LAUNCH_URL).getHost()')
    expect(ACTIVITY).toContain('startActivity(new Intent(Intent.ACTION_VIEW, uri))')
  })
})

describe('one source tree, one app per tenant', () => {
  it('everything tenant-specific arrives as a build property', () => {
    for (const p of ['quantixAppId', 'quantixAppLabel', 'quantixLaunchUrl', 'quantixVersion', 'quantixVersionCode']) {
      expect(GRADLE).toContain(`project.findProperty("${p}")`)
    }
  })

  it('no tenant is committed to the Android project', () => {
    for (const src of [GRADLE, MANIFEST, ACTIVITY]) {
      expect(src).not.toContain('laundrydrycleaners')
    }
  })

  it('the package id is unique per app AND per tenant', () => {
    // Two tenants installing "the delivery app" must not collide, and neither
    // must the three apps of one tenant.
    expect(SCRIPT).toContain('appId="in.quantixtechnology.laundry.$pkg.$(echo "$SLUG" | tr -cd \'[:alnum:]\')"')
  })

  it('the launcher icon is the one configured in Mobile Apps', () => {
    // Same route the manifest points at, so the installed icon and the icon in
    // the admin screen cannot disagree.
    expect(SCRIPT).toContain('/api/core/app-icon/$SLUG/$brand/192.png')
    expect(SCRIPT).toContain('mipmap-$1')
  })

  it('a failed icon fetch stops the build', () => {
    // curl -f, under set -e: shipping the wrong icon is worse than stopping.
    expect(SCRIPT).toContain('set -euo pipefail')
    expect(SCRIPT).toContain('curl -fsS')
  })

  it('the build stops rather than copying a stale APK', () => {
    expect(SCRIPT).toContain('BUILD PRODUCED NO APK')
    expect(SCRIPT).toContain('built="$WRAP/app/build/outputs/apk/$flavour/release/app-$flavour-release.apk"')
  })
})

describe('the builds are signed releases', () => {
  it('signing material comes from the environment', () => {
    expect(GRADLE).toContain('System.getenv("QUANTIX_KEYSTORE_PATH")')
    expect(GRADLE).toContain('System.getenv("QUANTIX_KEYSTORE_PASSWORD")')
    expect(GRADLE).toContain('System.getenv("QUANTIX_KEY_ALIAS")')
    expect(GRADLE).toContain('System.getenv("QUANTIX_KEY_PASSWORD")')
  })

  it('no keystore or password is in the repo', () => {
    expect(GRADLE).not.toMatch(/storePassword\s+"/)
    expect(GRADLE).not.toMatch(/keyPassword\s+"/)
    expect(GITIGNORE).toContain('*.jks')
    expect(GITIGNORE).toContain('*.keystore')
  })

  it('the release task is what the builder runs', () => {
    expect(SCRIPT).toContain('Release"')
    expect(SCRIPT).not.toContain('assembleDebug')
  })
})

describe('an APK a phone will actually parse', () => {
  // "There was a problem while parsing the package" is what a phone says about
  // an APK it cannot read, and it says nothing else — no log, no reason. So the
  // packaging leaves no room for the question: every device back to Android 5
  // is in range, and every signature scheme an installer might look for is
  // present.
  it('the floor is Android 5, not Android 7', () => {
    // minSdk above the device is one of the few ways a structurally perfect
    // APK still refuses to install, and the phone is the part we cannot see.
    expect(GRADLE).toContain('minSdk 21')
    expect(GRADLE).not.toContain('minSdk 24')
  })

  it('all three signature schemes are stated, not inferred', () => {
    // AGP drops v1 once minSdk reaches 24, leaving META-INF empty — valid to
    // the platform, but OEM installers and file managers still look there.
    expect(GRADLE).toContain('enableV1Signing true')
    expect(GRADLE).toContain('enableV2Signing true')
    expect(GRADLE).toContain('enableV3Signing true')
  })

  it('a build is verified before it is published', () => {
    expect(SCRIPT).toContain('apksigner" verify "$built"')
    expect(SCRIPT).toContain('SIGNATURE DID NOT VERIFY')
    expect(SCRIPT).toContain('zipalign" -c 4 "$built"')
    expect(SCRIPT).toContain('APK IS NOT ALIGNED')
  })

  it('the three entries a package needs are checked for', () => {
    expect(SCRIPT).toContain('for entry in AndroidManifest.xml classes.dex resources.arsc')
    expect(SCRIPT).toContain('APK IS MISSING $entry')
  })

  it('the check runs BEFORE the copy, not after', () => {
    // Verifying a file already sitting in public/apks proves nothing: it is
    // downloadable by then.
    const verify = SCRIPT.indexOf('apksigner" verify "$built"')
    const copy = SCRIPT.indexOf('cp "$built" "$OUT/$SLUG-$key.apk"')
    expect(verify).toBeGreaterThan(-1)
    expect(copy).toBeGreaterThan(verify)
  })

  it('the entry check does not pipe into grep', () => {
    // `unzip -l | grep -q` reads correctly and fails anyway: grep exits at the
    // first hit, unzip dies of SIGPIPE, and pipefail calls a good APK broken.
    expect(SCRIPT).not.toContain('unzip -l "$built" | grep')
    expect(SCRIPT).toContain('listing="$(unzip -l "$built")"')
  })

  it('the runtime permission call survives the older floor', () => {
    // Activity.requestPermissions does not exist below API 23.
    expect(ACTIVITY).toContain('ActivityCompat.requestPermissions(MainActivity.this')
    expect(codeOnly(ACTIVITY)).not.toContain('        requestPermissions(new String[]')
  })
})

describe('every host serves the APK as an APK', () => {
  // The download button is a RELATIVE link, so the host the admin happened to
  // be on decided what came back. On delivery.<tenant> and store.<tenant> the
  // proxy rewrites every path to that app's root, and on the storefront host
  // to a storefront page — so /apks/<tenant>-customer.apk answered 200
  // text/html. A phone that downloads 15 KB of HTML named .apk says "There was
  // a problem while parsing the package", which is a true statement about an
  // HTML file and tells you nothing about the APK.
  it('the proxy lets the APK path through untouched', () => {
    expect(PROXY).toContain("const SKIP_PATHS = ['/api', '/uploads', '/apks', '/sw.js'")
  })

  it('it is skipped like a file, not routed like a page', () => {
    // Same list as /uploads, and for the same reason: it is a download.
    const skip = PROXY.slice(PROXY.indexOf('const SKIP_PATHS'), PROXY.indexOf('const hostWithoutPort'))
    expect(skip).toContain("'/uploads'")
    expect(skip).toContain("'/apks'")
  })

  it('the link stays relative, so no host is hardcoded', () => {
    // Absolute URLs would fix the button and leave every link already shared
    // pointing at a web page.
    expect(ARTIFACTS).toContain('return `/${APK_DIR}/${file}`')
    expect(ARTIFACTS).not.toMatch(/https?:\/\//)
  })
})

describe('the download link points at a file that is there', () => {
  it('existence is checked, not assumed', () => {
    expect(ARTIFACTS).toContain('existsSync(join(process.cwd(), "public", APK_DIR, file))')
    expect(ARTIFACTS).toContain('return null')
  })

  it('the filename is scoped to the tenant', () => {
    expect(ARTIFACTS).toContain('`${slug}-${APK_BUILD_KEY[type]}.apk`')
    expect(ARTIFACTS).toContain('/^[a-z0-9-]+$/i.test(slug)')
  })

  it('the Store Admin card maps to the store build', () => {
    // The two names are the same three apps from different eras.
    expect(ARTIFACTS).toContain('ADMIN_APP: "store"')
  })

  it('a built file beats a build service that is down', () => {
    expect(ROUTE).toContain('const local = builtApkUrl(biz?.slug, type)')
    expect(ROUTE).toContain('apk[type] = { url: local, status: "BUILT" }; continue')
  })

  it('the pipeline URL is still the fallback', () => {
    expect(ROUTE).toContain('typeof cfg.apkUrl === "string"')
    expect(ROUTE).toContain('const url = cfgApk ?? d.liveUrl ?? null')
    expect(ROUTE).toContain('url: d.status === "LIVE" && url ? url : null')
  })

  it('an app with neither says so', () => {
    expect(ROUTE).toContain('apk[type] = { url: null, status: "NOT_BUILT" }; continue')
  })
})
