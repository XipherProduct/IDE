#!/usr/bin/env bash
# Xipher IDE — установка как приложение (Linux).
#   curl -fsSL https://ide.xipher.pro/install.sh | bash
# Скачивает AppImage, делает его исполняемым, добавляет в меню приложений с иконкой.
set -euo pipefail

BASE="https://ide.xipher.pro"
APP_URL="$BASE/download/Xipher_IDE-x86_64.AppImage"
BIN_DIR="$HOME/.local/bin"
APP="$BIN_DIR/Xipher-IDE.AppImage"
ICON_DIR="$HOME/.local/share/icons"
ICON="$ICON_DIR/xipher-ide.png"
DESKTOP_DIR="$HOME/.local/share/applications"
DESKTOP="$DESKTOP_DIR/xipher-ide.desktop"

say() { printf '\033[36m›\033[0m %s\n' "$*"; }
mkdir -p "$BIN_DIR" "$ICON_DIR" "$DESKTOP_DIR"

say "Скачиваю Xipher IDE… (~280 МБ)"
if command -v curl >/dev/null 2>&1; then curl -fSL --progress-bar -o "$APP" "$APP_URL"
elif command -v wget >/dev/null 2>&1; then wget -q --show-progress -O "$APP" "$APP_URL"
else echo "Нужен curl или wget."; exit 1; fi

# ГЛАВНОЕ: делаем исполняемым (то, что теряется при скачивании браузером)
chmod +x "$APP"
say "Готово: файл теперь исполняемый."

# иконка — вытаскиваем из самого AppImage (.DirIcon обычно симлинк на реальный png)
say "Настраиваю ярлык…"
TMP="$(mktemp -d)"
( cd "$TMP" && "$APP" --appimage-extract .DirIcon >/dev/null 2>&1 ) || true
DI="$TMP/squashfs-root/.DirIcon"
if [ -L "$DI" ]; then
  TGT="$(readlink "$DI")"
  ( cd "$TMP" && "$APP" --appimage-extract "$TGT" >/dev/null 2>&1 ) || true
  [ -f "$TMP/squashfs-root/$TGT" ] && cp "$TMP/squashfs-root/$TGT" "$ICON" 2>/dev/null || true
elif [ -f "$DI" ]; then
  cp "$DI" "$ICON" 2>/dev/null || true
fi
rm -rf "$TMP"
[ -f "$ICON" ] || ICON=""

cat > "$DESKTOP" <<EOF
[Desktop Entry]
Type=Application
Name=Xipher IDE
Comment=Xipher IDE — форк VS Code с ИИ-агентом
Exec=$APP --no-sandbox %U
Icon=${ICON:-utilities-terminal}
Terminal=false
Categories=Development;IDE;TextEditor;
StartupWMClass=Xipher IDE
MimeType=text/plain;inode/directory;
EOF
chmod +x "$DESKTOP" 2>/dev/null || true
update-desktop-database "$DESKTOP_DIR" >/dev/null 2>&1 || true

echo
say "✓ Установлено. «Xipher IDE» теперь в меню приложений — запускай как обычную программу."
say "  Или из терминала:  $APP"
