#!/usr/bin/env bash
# sync-aars.sh
#
# Builds release AARs from appambit-sdk-android and distributes them to the
# correct React Native SDK library:
#
#   appambit-sdk-release.aar                  → appambit_sdk_react_native/android/libs/
#   appambit-sdk-push-notifications-release.aar → appambit-push-notifications/android/libs/
#
# Usage:
#   From push/appambit-push-notifications/:
#     bash scripts/sync-aars.sh
#
#   Optionally pass the path to the Android SDK repo:
#     bash scripts/sync-aars.sh /path/to/appambit-sdk-android

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# push/appambit-push-notifications/
PUSH_RN_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
# appambit-sdk-react-native/
RN_REPO_ROOT="$(cd "$PUSH_RN_ROOT/../.." && pwd)"
# appambit_sdk_react_native/
CORE_RN_ROOT="$RN_REPO_ROOT/appambit_sdk_react_native"
# appambit-sdk-android/ (sibling of appambit-sdk-react-native/)
ANDROID_SDK_ROOT="${1:-"$(cd "$RN_REPO_ROOT/../appambit-sdk-android" && pwd)"}"

echo "📍 Android SDK root : $ANDROID_SDK_ROOT"
echo "📍 Core RN lib root : $CORE_RN_ROOT"
echo "📍 Push RN lib root : $PUSH_RN_ROOT"
echo ""

# ── 1. Build release AARs ─────────────────────────────────────────────────────
echo "🔨 Building release AARs..."
(cd "$ANDROID_SDK_ROOT" && ./gradlew :appambit-sdk:assembleRelease :appambit-sdk-push-notifications:assembleRelease --quiet)
echo "✅ Build complete"
echo ""

# ── 2. Core SDK AAR → Core RN library ─────────────────────────────────────────
CORE_LIBS="$CORE_RN_ROOT/android/libs"
mkdir -p "$CORE_LIBS"
cp "$ANDROID_SDK_ROOT/appambit-sdk/build/outputs/aar/appambit-sdk-release.aar" \
   "$CORE_LIBS/appambit-sdk-release.aar"
echo "📦 Core AAR → $CORE_LIBS/appambit-sdk-release.aar"

# ── 3. Push SDK AAR → Push RN library ─────────────────────────────────────────
PUSH_LIBS="$PUSH_RN_ROOT/android/libs"
mkdir -p "$PUSH_LIBS"
cp "$ANDROID_SDK_ROOT/push/appambit-sdk-push-notifications/build/outputs/aar/appambit-sdk-push-notifications-release.aar" \
   "$PUSH_LIBS/appambit-sdk-push-notifications-release.aar"
echo "📦 Push AAR → $PUSH_LIBS/appambit-sdk-push-notifications-release.aar"

echo ""
echo "✅ Done. AAR inventory:"
echo ""
echo "  Core RN lib (appambit_sdk_react_native/android/libs/):"
ls -lh "$CORE_LIBS"
echo ""
echo "  Push RN lib (appambit-push-notifications/android/libs/):"
ls -lh "$PUSH_LIBS"
