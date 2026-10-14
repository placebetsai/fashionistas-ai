# Fashionistas — Android & iOS (Capacitor)

The app is a native shell around https://fashionistas.ai (`server.url`), so every web deploy updates the apps with no store re-review for content changes. The free try-on, listing and crosslisting work in the shell exactly as on the web. The camera uses the file input, and `@capacitor/camera` is included for a native picker later.

Android also has a TWA option: see `docs/twa/` (Bubblewrap). TWA is lighter, but it needs `/.well-known/assetlinks.json` with the release key's SHA-256.

## Build
```
cd mobile/capacitor && npm install
npx cap add android && npx cap add ios      # creates android/ and ios/ projects
npx cap sync
npx cap open android    # Android Studio → Build → Generate Signed Bundle (AAB) → Play Console
npx cap open ios        # Xcode (macOS) → set Team → Product → Archive → App Store Connect
```
iOS: add `WKAppBoundDomains` = [fashionistas.ai] to `ios/App/App/Info.plist` (required by `limitsNavigationsToAppBoundDomains`), plus `NSCameraUsageDescription` and `NSPhotoLibraryUsageDescription`.
Android: add the CAMERA permission in `AndroidManifest.xml` only if the native camera plugin is used.

## Needed from Iz
- Google Play Console account ($25 one-time) and the upload key (kept off-repo).
- Apple Developer Program ($99/yr), a Mac with Xcode, and the bundle id `ai.fashionistas.app`.
- Store listing: icon 1024², screenshots (we have 412×915 QA shots), privacy URL https://fashionistas.ai/privacy/, account deletion URL https://fashionistas.ai/account/delete/.
