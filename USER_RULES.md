# User Rules & Preferences

This file contains specific rules, settings, and reminders that the AI Assistant must follow when working on this project.

## 1. Build & Versioning
- **Output Filenames**: Every build artifact (e.g., `.aab`, `.apk`) MUST include the version name in its filename (e.g., `votechaos-v1.0.13-release.aab`).
- **Version Bumping**: When increasing the app version, you MUST update it in THREE places:
    1. `package.json` (`version` field)
    2. `android/app/build.gradle` (`versionCode` and `versionName`)
    3. `src/pages/HomePage.tsx` (UI display text)
- **Rebuilds**: Always perform a clean build when key configurations or frontend logic changes (`clean bundleRelease`).

## 2. Configuration & Logic
- **Dynamic Configs**: DO NOT hardcode limits (e.g., character counts, pricing). ALWAYS fetch and use backend system configurations (e.g., `description_max_length`, `vote_button_amounts`).
- **Atomic Operations**: Use server-side atomic functions (RPCs) for critical actions like voting, ad watching, and token transactions.

## 3. UI/UX Standards
- **Error Handling**: Display specific error messages returned by the server/RPC in Toasts, rather than generic "Failed" messages.
- **Android Navigation**: Ensure the hardware back button is handled correctly (exit app on root pages, go back on others) using `@capacitor/app`.
- **Aesthetics**: Maintain the premium, "Chaos" themed design language (gradients, glassmorphism).

## 4. Workflows
- **Check This File**: Review this file before starting major tasks to ensure compliance with latest user preferences.
