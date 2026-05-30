#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# AppAmbit Test App Runner
# Uso:  ./run-app.sh ios     [--skip-clean] [--skip-pods]
#       ./run-app.sh android [--skip-clean]
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
METRO_PORT=8081
NATIVE_LOG_PID=""

# ── Colores ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; PURPLE='\033[0;35m'; BOLD='\033[1m'; NC='\033[0m'

log()     { echo -e "${CYAN}▶${NC}  $*"; }
success() { echo -e "${GREEN}✓${NC}  $*"; }
warn()    { echo -e "${YELLOW}⚠${NC}  $*"; }
err()     { echo -e "${RED}✗${NC}  $*"; }

usage() {
  echo ""
  echo -e "${BOLD}Uso:${NC}  ./run-app.sh <plataforma> [opciones]"
  echo ""
  echo "  Plataformas:"
  echo "    ios       Correr en simulador iOS"
  echo "    android   Correr en dispositivo/emulador Android"
  echo ""
  echo "  Opciones:"
  echo "    --skip-clean   Omite limpieza de caché"
  echo "    --skip-pods    Omite pod install  (solo iOS)"
  echo ""
  exit 1
}

# ── Helpers ───────────────────────────────────────────────────────────────────
kill_metro() {
  local pid
  pid=$(lsof -ti:$METRO_PORT 2>/dev/null || true)
  if [[ -n "$pid" ]]; then
    log "Matando Metro en puerto $METRO_PORT (PID $pid)..."
    kill -9 $pid 2>/dev/null || true
    sleep 1
    success "Metro detenido"
  fi
}

wait_for_metro() {
  log "Esperando que Metro esté listo..."
  local i=0
  while (( i < 45 )); do
    if curl -s "http://localhost:$METRO_PORT/status" > /dev/null 2>&1; then
      success "Metro listo en http://localhost:$METRO_PORT"
      return 0
    fi
    sleep 1
    (( i++ ))
  done
  err "Metro no respondió en 45 segundos"
  exit 1
}

clean_metro_cache() {
  log "Limpiando caché de Metro..."
  rm -rf "$SCRIPT_DIR/node_modules/.cache" 2>/dev/null || true
  rm -rf "${TMPDIR:-/tmp}/metro-*"          2>/dev/null || true
  rm -rf "${TMPDIR:-/tmp}/haste-*"          2>/dev/null || true
  success "Caché de Metro limpiada"
}

METRO_LOG="${TMPDIR:-/tmp}/appambit-metro.log"
METRO_PID=""

start_metro() {
  # Si ya hay un Metro respondiendo en el puerto, reutilizarlo.
  if curl -s "http://localhost:$METRO_PORT/status" > /dev/null 2>&1; then
    success "Metro ya está corriendo en puerto $METRO_PORT — reutilizando"
    METRO_PID=$(lsof -ti:$METRO_PORT 2>/dev/null | head -1 || true)
    return 0
  fi

  kill_metro
  log "Iniciando Metro con caché limpia (--reset-cache)..."
  cd "$SCRIPT_DIR"
  # Redirigir salida a un archivo para evitar suspensión del proceso
  # cuando el proceso padre no tiene TTY disponible (zsh job control).
  yarn start --reset-cache > "$METRO_LOG" 2>&1 &
  METRO_PID=$!
  disown "$METRO_PID"
  wait_for_metro
}

stop_metro() {
  # Solo matar Metro si lo iniciamos nosotros (METRO_PID pertenece al proceso yarn)
  if [[ -n "$METRO_PID" ]]; then
    kill "$METRO_PID" 2>/dev/null || true
  fi
}

# ── Logs nativos ──────────────────────────────────────────────────────────────
start_ios_native_logs() {
  local udid="$1"
  local bundle_id="com.AppAmbit.TestAppSwift"

  log "Activando stream de logs iOS (sin relanzar la app)..."
  # Do NOT terminate and relaunch — a second xcrun simctl launch causes
  # "PlatformConstants could not be found" TurboModule errors.
  # xcrun simctl spawn log stream captures NSLog, os_log and print() output
  # (the Simulator redirects the app's stdout/stderr to the unified log)
  # from the already-running process without touching it.
  xcrun simctl spawn "$udid" log stream \
    --predicate 'process == "AppambitExample"' \
    --level debug \
    2>&1 \
    | awk 'BEGIN{p="\033[0;35m"; r="\033[0m"} {print p "[iOS]" r " " $0; fflush()}' &
  NATIVE_LOG_PID=$!
  success "Logs nativos iOS activos — log stream de AppambitExample (PID $NATIVE_LOG_PID)"
}

start_android_native_logs() {
  local device_id="$1"
  log "Iniciando stream de logs Android (logcat filtrado)..."
  adb -s "$device_id" logcat -c 2>/dev/null || true

  # Filtra solo tags relevantes: JS console.* + SDK AppAmbit + crashes
  adb -s "$device_id" logcat -v time \
    'ReactNativeJS:V' \
    'ReactNative:W' \
    'AppAmbit:D' \
    'AppAmbitEmitter:D' \
    'AppAmbitRNExtension:D' \
    'AppAmbitPushModule:D' \
    'AppAmbitMessagingService:D' \
    'AppAmbitHeadless:D' \
    'AppAmbitInitProvider:D' \
    'AndroidRuntime:E' \
    'System.err:W' \
    '*:S' 2>/dev/null \
    | awk 'BEGIN{p="\033[1;33m"; r="\033[0m"} {print p "[ANDROID]" r " " $0; fflush()}' &

  NATIVE_LOG_PID=$!
  success "Logs Android activos (PID $NATIVE_LOG_PID)"
}

# ── iOS ───────────────────────────────────────────────────────────────────────
run_ios() {
  # 1. Limpieza
  if $SKIP_CLEAN; then
    warn "Limpieza omitida (--skip-clean)"
  else
    log "Limpiando DerivedData..."
    rm -rf ~/Library/Developer/Xcode/DerivedData/AppambitExample-* 2>/dev/null || true
    success "DerivedData eliminado"

    clean_metro_cache
  fi

  # 2. Pod install
  if $SKIP_PODS; then
    warn "Pod install omitido (--skip-pods)"
  else
    log "Ejecutando pod install..."
    cd "$SCRIPT_DIR/ios"
    pod install
    cd "$SCRIPT_DIR"
    success "Pods instalados"
  fi

  # 3. Listar simuladores disponibles
  log "Buscando simuladores iOS disponibles..."

  local -a names=()
  local -a udids=()
  local -a states=()
  local current_os=""

  local re_os='^[[:space:]]*--[[:space:]](.+)[[:space:]]--[[:space:]]*$'
  local re_dev='^[[:space:]]+(.+)[[:space:]]+\(([0-9A-F-]{36})\)[[:space:]]+\(([^)]+)\)'

  while IFS= read -r line; do
    # Cabecera de OS: "-- iOS 17.0 --"
    if [[ "$line" =~ $re_os ]]; then
      current_os="${BASH_REMATCH[1]}"
      continue
    fi
    # Dispositivo: "    iPhone 17 Pro (UUID) (Booted)"
    if [[ "$line" =~ $re_dev ]]; then
      names+=("${BASH_REMATCH[1]} — $current_os")
      udids+=("${BASH_REMATCH[2]}")
      states+=("${BASH_REMATCH[3]}")
    fi
  done < <(xcrun simctl list devices available 2>/dev/null)

  if [[ ${#udids[@]} -eq 0 ]]; then
    err "No se encontraron simuladores iOS disponibles"
    exit 1
  fi

  echo ""
  echo -e "${BOLD}Simuladores disponibles:${NC}  (🟢 Encendido  ⚫ Apagado)"
  for i in "${!names[@]}"; do
    local icon="⚫"
    [[ "${states[$i]}" == "Booted" ]] && icon="🟢"
    printf "  %2d. %s  %s\n" "$((i+1))" "$icon" "${names[$i]}"
  done
  echo -e "   q. Salir"
  echo ""

  local choice
  read -rp "$(echo -e "${BOLD}Elige un simulador${NC} [1-${#udids[@]}, q]: ")" choice

  [[ "$choice" == "q" || "$choice" == "Q" ]] && { log "Cancelado."; exit 0; }

  if ! [[ "$choice" =~ ^[0-9]+$ ]] || (( choice < 1 || choice > ${#udids[@]} )); then
    err "Selección inválida: '$choice'"
    exit 1
  fi

  local idx=$(( choice - 1 ))
  local sel_udid="${udids[$idx]}"
  local sel_name="${names[$idx]}"
  local sel_state="${states[$idx]}"
  success "Seleccionado: $sel_name"

  # 4. Encender simulador si está apagado
  if [[ "$sel_state" != "Booted" ]]; then
    log "Iniciando simulador..."
    xcrun simctl boot "$sel_udid"
    open -a Simulator
    sleep 3
    success "Simulador iniciado"
  else
    open -a Simulator 2>/dev/null || true
  fi

  # 5. Metro
  start_metro

  # 6. Compilar y lanzar
  log "Compilando y lanzando app en '$sel_name'..."
  cd "$SCRIPT_DIR"
  yarn react-native run-ios --udid "$sel_udid" --no-packager

  success "App lanzada en $sel_name"

  # 7. Stream de logs nativos iOS (sin relanzar la app)
  start_ios_native_logs "$sel_udid"

  echo ""
  echo -e "${BOLD}Streams activos  (Ctrl+C para detener todo):${NC}"
  echo -e "  ${CYAN}[METRO]${NC}        → $METRO_LOG"
  echo -e "  ${PURPLE}[iOS]${NC}          → log stream nativo del simulador"
  echo ""
  # Mostrar Metro log + logs nativos hasta Ctrl+C
  tail -f "$METRO_LOG" \
    | awk 'BEGIN{c="\033[0;36m"; r="\033[0m"} {print c "[METRO]" r " " $0; fflush()}' &
  METRO_TAIL_PID=$!
  trap 'echo ""; log "Deteniendo Metro y logs..."; stop_metro; kill "$METRO_TAIL_PID" 2>/dev/null || true; [[ -n "$NATIVE_LOG_PID" ]] && kill "$NATIVE_LOG_PID" 2>/dev/null || true; exit 0' INT TERM
  wait $NATIVE_LOG_PID 2>/dev/null || true
}

# ── Android ───────────────────────────────────────────────────────────────────
run_android() {
  # 1. Limpieza
  if $SKIP_CLEAN; then
    warn "Limpieza omitida (--skip-clean)"
  else
    log "Limpiando build de Android (gradle clean)..."
    cd "$SCRIPT_DIR/android"
    ./gradlew clean --quiet 2>/dev/null && success "Gradle clean listo" || warn "Gradle clean falló (continuando)"
    cd "$SCRIPT_DIR"

    log "Limpiando caché de Gradle..."
    rm -rf ~/.gradle/caches/build-cache-* 2>/dev/null || true
    rm -rf ~/.gradle/caches/transforms-*  2>/dev/null || true
    success "Caché de Gradle limpiada"

    clean_metro_cache
  fi

  # 2. Listar dispositivos conectados y emuladores
  log "Buscando dispositivos Android..."

  local -a dev_names=()
  local -a dev_ids=()

  # — Físicos y emuladores YA corriendo —
  while IFS= read -r line; do
    [[ "$line" == "List of devices attached" ]] && continue
    [[ -z "${line// }" ]] && continue
    if [[ "$line" == *$'\tdevice' ]]; then
      local id
      id=$(echo "$line" | awk '{print $1}')
      local model
      model=$(adb -s "$id" shell getprop ro.product.model 2>/dev/null | tr -d '\r' || echo "Device")
      local api
      api=$(adb -s "$id" shell getprop ro.build.version.sdk 2>/dev/null | tr -d '\r' || echo "?")
      if [[ "$id" == emulator-* ]]; then
        local avd
        avd=$(adb -s "$id" emu avd name 2>/dev/null | head -1 | tr -d '\r' || echo "Emulator")
        dev_names+=("🤖 $avd  (API $api) [$id]")
      else
        dev_names+=("📱 $model  (API $api) [$id]")
      fi
      dev_ids+=("$id")
    fi
  done < <(adb devices 2>/dev/null)

  # — AVDs disponibles (no iniciados) —
  if command -v emulator &>/dev/null; then
    while IFS= read -r avd; do
      [[ -z "$avd" ]] && continue
      dev_names+=("🤖 $avd  (AVD — no iniciado)")
      dev_ids+=("avd:$avd")
    done < <(emulator -list-avds 2>/dev/null || true)
  fi

  if [[ ${#dev_ids[@]} -eq 0 ]]; then
    err "No hay dispositivos/emuladores Android disponibles"
    echo "  → Conecta un dispositivo con USB Debugging habilitado, o"
    echo "  → Inicia un AVD desde Android Studio"
    exit 1
  fi

  echo ""
  echo -e "${BOLD}Dispositivos disponibles:${NC}"
  for i in "${!dev_names[@]}"; do
    printf "  %2d. %s\n" "$((i+1))" "${dev_names[$i]}"
  done
  echo -e "   q. Salir"
  echo ""

  local choice
  read -rp "$(echo -e "${BOLD}Elige un dispositivo${NC} [1-${#dev_ids[@]}, q]: ")" choice

  [[ "$choice" == "q" || "$choice" == "Q" ]] && { log "Cancelado."; exit 0; }

  if ! [[ "$choice" =~ ^[0-9]+$ ]] || (( choice < 1 || choice > ${#dev_ids[@]} )); then
    err "Selección inválida: '$choice'"
    exit 1
  fi

  local idx=$(( choice - 1 ))
  local sel_id="${dev_ids[$idx]}"
  local sel_name="${dev_names[$idx]}"

  # 3. Iniciar AVD si es necesario
  if [[ "$sel_id" == avd:* ]]; then
    local avd_name="${sel_id#avd:}"
    log "Iniciando emulador '$avd_name'..."
    emulator -avd "$avd_name" -no-snapshot-load &
    EMULATOR_PID=$!

    log "Esperando arranque del emulador..."
    local attempts=0
    while (( attempts < 90 )); do
      sel_id=$(adb devices 2>/dev/null | grep $'\tdevice' | grep emulator | awk '{print $1}' | head -1 || true)
      if [[ -n "$sel_id" ]]; then
        local booted
        booted=$(adb -s "$sel_id" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || echo "0")
        [[ "$booted" == "1" ]] && break
      fi
      sleep 2
      (( attempts++ ))
    done
    success "Emulador listo: $sel_id"
  fi

  success "Seleccionado: $sel_name"

  # 4. Metro
  start_metro

  # 5. Redirigir puerto Metro al dispositivo (funciona en físicos y emuladores).
  log "Redirigiendo puerto Metro al dispositivo (adb reverse)..."
  adb -s "$sel_id" reverse tcp:$METRO_PORT tcp:$METRO_PORT 2>/dev/null \
    && success "Puerto $METRO_PORT redirigido" \
    || warn "adb reverse falló — asegúrate de que el dispositivo esté conectado"

  # Detectar si 10.0.2.2 es alcanzable (para usarlo después del build)
  local host_reachable
  host_reachable=$(adb -s "$sel_id" shell "nc -z -w 2 10.0.2.2 $METRO_PORT 2>/dev/null && echo ok || echo fail" | tr -d '\r')

  # 6. Compilar y lanzar
  log "Compilando e instalando en '$sel_name'..."
  cd "$SCRIPT_DIR"
  yarn react-native run-android --deviceId "$sel_id" --no-packager

  success "App lanzada en $sel_name"

  # 6b. Si 10.0.2.2 no es alcanzable (VPN u otro problema de red), escribir
  #     la preferencia de Metro para que RN use localhost (via adb reverse).
  local pkg="com.AppAmbit.TestApp"
  local prefs_file="${pkg}_preferences.xml"
  if [[ "$host_reachable" != "ok" ]]; then
    warn "10.0.2.2 no alcanzable — forzando debug_http_host=localhost:$METRO_PORT via preferencias"
    printf '<?xml version="1.0" encoding="utf-8"?>\n<map>\n<string name="debug_http_host">localhost:%s</string>\n</map>\n' "$METRO_PORT" | \
      adb -s "$sel_id" shell "run-as $pkg sh -c 'mkdir -p shared_prefs && cat > shared_prefs/$prefs_file'" 2>/dev/null \
      && success "Preferencia debug_http_host=localhost:$METRO_PORT escrita — relanzando app" \
      || warn "No se pudo escribir la preferencia (run-as sin permisos)"
    # Relanzar para que RN lea la nueva preferencia
    adb -s "$sel_id" shell am force-stop "$pkg" 2>/dev/null || true
    sleep 1
    adb -s "$sel_id" shell am start -n "$pkg/.MainActivity" 2>/dev/null || true
  fi

  # 7. Stream de logs nativos Android
  start_android_native_logs "$sel_id"

  echo ""
  echo -e "${BOLD}Streams activos  (Ctrl+C para detener todo):${NC}"
  echo -e "  ${CYAN}[METRO]${NC}        → $METRO_LOG"
  echo -e "  ${YELLOW}[ANDROID]${NC}      → logcat nativo del dispositivo"
  echo ""
  # Mostrar Metro log + logs nativos hasta Ctrl+C
  tail -f "$METRO_LOG" \
    | awk 'BEGIN{c="\033[0;36m"; r="\033[0m"} {print c "[METRO]" r " " $0; fflush()}' &
  METRO_TAIL_PID=$!
  trap 'echo ""; log "Deteniendo Metro y logs..."; stop_metro; kill "$METRO_TAIL_PID" 2>/dev/null || true; [[ -n "$NATIVE_LOG_PID" ]] && kill "$NATIVE_LOG_PID" 2>/dev/null || true; exit 0' INT TERM
  wait $NATIVE_LOG_PID 2>/dev/null || true
}

# ── Main ──────────────────────────────────────────────────────────────────────
PLATFORM="${1:-}"
[[ -z "$PLATFORM" ]] && usage

SKIP_CLEAN=false
SKIP_PODS=false

for arg in "${@:2}"; do
  case "$arg" in
    --skip-clean) SKIP_CLEAN=true ;;
    --skip-pods)  SKIP_PODS=true  ;;
    *) err "Opción desconocida: '$arg'"; usage ;;
  esac
done

echo ""
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║   AppAmbit Test App Runner  🚀       ║${NC}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════╝${NC}"
echo ""

case "$PLATFORM" in
  ios)     run_ios     ;;
  android) run_android ;;
  *)       err "Plataforma desconocida: '$PLATFORM'"; usage ;;
esac
