#!/usr/bin/env bash
# setup.sh — full monorepo refresh to get the test app working
#
# Usage: ./setup.sh [options]
#   --deep          Delete node_modules in all packages before installing
#   --ios           Run bundle install + pod install at the end
#   --skip-push     Skip the push notifications SDK
#   --skip-build    Skip yarn prepare (install only, do not compile)
#
# Order:
#   1. Core SDK     → clean → install → prepare (build to lib/)
#   2. Push SDK     → clean → install → prepare
#   3. Test app     → install (already a workspace under core, but enforced)
#   4. iOS (--ios)  → bundle install → pod install
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORE="$ROOT/appambit_sdk_react_native"
PUSH="$ROOT/push/appambit-push-notifications"
TEST_APP="$CORE/appambit_test_app"

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()     { echo -e "${CYAN}▶${NC}  $*"; }
success() { echo -e "${GREEN}✓${NC}  $*"; }
warn()    { echo -e "${YELLOW}⚠${NC}  $*"; }
err()     { echo -e "${RED}✗${NC}  $*"; exit 1; }
section() { echo -e "\n${BOLD}${CYAN}── $* ──────────────────────────────────────────${NC}"; }

# ── Flags ─────────────────────────────────────────────────────────────────────
DEEP=false
IOS=false
SKIP_PUSH=false
SKIP_BUILD=false

for arg in "$@"; do
  case "$arg" in
    --deep)       DEEP=true      ;;
    --ios)        IOS=true       ;;
    --skip-push)  SKIP_PUSH=true ;;
    --skip-build) SKIP_BUILD=true ;;
    --help|-h)
      grep '^#' "$0" | head -12 | sed 's/^# \?//'
      exit 0
      ;;
    *) err "Unknown option: '$arg'. Use --help to see available options." ;;
  esac
done

# ── Prerequisites ─────────────────────────────────────────────────────────────
require_cmd() {
  local cmd="$1" hint="${2:-}"
  if ! command -v "$cmd" &>/dev/null; then
    err "Missing required command '$cmd'.${hint:+ → $hint}"
  fi
}

require_cmd node  "Install Node >=20 (https://nodejs.org or nvm)."
require_cmd yarn  "Install Yarn: 'npm install -g yarn' or 'corepack enable'."

echo ""
echo -e "${BOLD}${CYAN}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║   AppAmbit — Full monorepo setup          ║${NC}"
echo -e "${BOLD}${CYAN}╚═══════════════════════════════════════════╝${NC}"
echo ""
$DEEP       && warn "--deep mode: node_modules will be deleted in all packages"
$IOS        && log  "iOS enabled: bundle install + pod install will run at the end"
$SKIP_PUSH  && warn "Push SDK: skipped (--skip-push)"
$SKIP_BUILD && warn "Build skipped: --skip-build active"

# ── Helper: wipe node_modules ─────────────────────────────────────────────────
deep_clean_pkg() {
  local dir="$1" name="$2"
  if [[ -d "$dir/node_modules" ]]; then
    log "[$name] Deleting node_modules..."
    rm -rf "$dir/node_modules"
    success "[$name] node_modules removed"
  fi
  if [[ -d "$dir/lib" ]]; then
    log "[$name] Deleting lib/ (previous build)..."
    rm -rf "$dir/lib"
    success "[$name] lib/ removed"
  fi
}

# ── 1. Core SDK ───────────────────────────────────────────────────────────────
section "Core SDK  (appambit_sdk_react_native)"

$DEEP && deep_clean_pkg "$CORE" "core"

# yarn clean removes lib/ and build/ artifacts
if [[ -f "$CORE/package.json" ]] && ! $DEEP; then
  log "[core] Cleaning previous build (yarn clean)..."
  (cd "$CORE" && yarn clean 2>/dev/null) && success "[core] Clean OK" || warn "[core] yarn clean failed (continuing)"
fi

log "[core] Installing dependencies (yarn install)..."
(cd "$CORE" && yarn install)
success "[core] Dependencies installed"

if ! $SKIP_BUILD; then
  log "[core] Building SDK (yarn prepare)..."
  (cd "$CORE" && yarn prepare)
  success "[core] SDK built → lib/"
fi

# ── 2. Push SDK ───────────────────────────────────────────────────────────────
if ! $SKIP_PUSH; then
  section "Push SDK  (appambit-push-notifications)"

  $DEEP && deep_clean_pkg "$PUSH" "push"

  if [[ -f "$PUSH/package.json" ]] && ! $DEEP; then
    log "[push] Cleaning previous build (yarn clean)..."
    (cd "$PUSH" && yarn clean 2>/dev/null) && success "[push] Clean OK" || warn "[push] yarn clean failed (continuing)"
  fi

  log "[push] Installing dependencies (yarn install)..."
  (cd "$PUSH" && yarn install)
  success "[push] Dependencies installed"

  if ! $SKIP_BUILD; then
    log "[push] Building SDK (yarn prepare)..."
    (cd "$PUSH" && yarn prepare)
    success "[push] SDK built → lib/"
  fi
fi

# ── 3. Test app ───────────────────────────────────────────────────────────────
section "Test app  (appambit_test_app)"

# The test app is a Yarn workspace under the core SDK, so yarn install in $CORE
# already covers it. We verify react-native is present and re-install if not.
if [[ ! -d "$TEST_APP/node_modules/react-native" ]]; then
  log "[test-app] node_modules/react-native missing — reinstalling from workspace..."
  (cd "$TEST_APP" && yarn install)
  success "[test-app] Dependencies installed"
else
  success "[test-app] node_modules OK (react-native present)"
fi

# Clear Metro cache so the next launch starts clean
log "[test-app] Clearing Metro cache..."
rm -rf "$TEST_APP/node_modules/.cache"              2>/dev/null || true
rm -rf "${TMPDIR:-/tmp}/metro-"*                    2>/dev/null || true
rm -rf "${TMPDIR:-/tmp}/haste-"*                    2>/dev/null || true
rm -rf "${TMPDIR:-/tmp}/react-native-packager-cache"* 2>/dev/null || true
success "[test-app] Metro cache cleared"

# ── 4. iOS (optional) ─────────────────────────────────────────────────────────
if $IOS; then
  section "iOS  (bundle install + pod install)"

  require_cmd xcrun "Install Xcode and Command Line Tools ('xcode-select --install')."

  IOS_DIR="$TEST_APP/ios"

  # Prefer CocoaPods via Bundler (pinned version in Gemfile), fall back to global pod
  POD_CMD=""
  if [[ -f "$TEST_APP/Gemfile" ]] && command -v bundle &>/dev/null; then
    log "[ios] Installing gems (bundle install)..."
    (cd "$TEST_APP" && bundle install)
    POD_CMD="bundle exec pod"
    success "[ios] Gems installed"
  elif command -v pod &>/dev/null; then
    POD_CMD="pod"
    warn "[ios] Using global CocoaPods (not Bundler)"
  else
    err "CocoaPods not found. Install with: 'sudo gem install cocoapods'"
  fi

  # Wipe existing Pods for a clean install
  log "[ios] Removing previous Pods..."
  rm -rf "$IOS_DIR/Pods"               2>/dev/null || true
  rm -f  "$IOS_DIR/Podfile.lock"       2>/dev/null || true
  rm -rf ~/Library/Developer/Xcode/DerivedData/AppambitExample-* 2>/dev/null || true
  success "[ios] Pods and DerivedData removed"

  log "[ios] Running $POD_CMD install..."
  (cd "$IOS_DIR" && $POD_CMD install)
  success "[ios] Pods installed"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║   Setup completed successfully  ✓        ║${NC}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${GREEN}✓${NC} Core SDK built at ${BOLD}appambit_sdk_react_native/lib/${NC}"
$SKIP_PUSH || echo -e "  ${GREEN}✓${NC} Push SDK built at ${BOLD}push/appambit-push-notifications/lib/${NC}"
echo -e "  ${GREEN}✓${NC} Test app ready at ${BOLD}appambit_sdk_react_native/appambit_test_app/${NC}"
$IOS       && echo -e "  ${GREEN}✓${NC} iOS Pods installed"
echo ""
echo -e "To run the app:"
echo -e "  ${CYAN}cd appambit_sdk_react_native/appambit_test_app${NC}"
echo -e "  ${CYAN}./run-app.sh ios${NC}      ${YELLOW}# iOS${NC}"
echo -e "  ${CYAN}./run-app.sh android${NC}  ${YELLOW}# Android${NC}"
echo ""
