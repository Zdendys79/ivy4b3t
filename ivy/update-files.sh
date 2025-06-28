#!/bin/bash

# update-files.sh
# Umístění: ~/ivy/update-files.sh
#
# Popis: Pomocný skript pro získání aktuální verze souborů z Git repozitáře.
#        Používá společný modul git-common.sh pro Git operace.
#        Tento skript POUZE stáhne a synchronizuje soubory bez spouštění aplikace.

# ===========================================
# 📂 KONFIGURACE A INICIALIZACE
# ===========================================

# Zjisti adresář skriptu
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Import společného modulu
if [[ -f "$SCRIPT_DIR/git-common.sh" ]]; then
    source "$SCRIPT_DIR/git-common.sh"
else
    echo "CHYBA: Nepodařilo se načíst git-common.sh ze $SCRIPT_DIR"
    exit 1
fi

# Přepis výchozích cest pokud je potřeba
REPO_DIR=${REPO_DIR:-~/git/ivy4b3t}
SOURCE_SUBFOLDER=${SOURCE_SUBFOLDER:-ivy}
TARGET_DIR=${TARGET_DIR:-~/ivy}

# ===========================================
# 🔧 FUNKCE SPECIFICKÉ PRO UPDATE-FILES
# ===========================================

# Zobrazí aktuální stav repozitáře a souborů
show_status() {
    log_info "=== AKTUÁLNÍ STAV ==="

    if [[ -d "$REPO_DIR" ]]; then
        log_info "Git repozitář: $REPO_DIR"
        get_git_info "$REPO_DIR"
    else
        log_error "Git repozitář $REPO_DIR neexistuje!"
        return 1
    fi

    echo ""

    if [[ -d "$TARGET_DIR" ]]; then
        log_info "Cílový adresář: $TARGET_DIR"
        local file_count=$(find "$TARGET_DIR" -type f | wc -l)
        local dir_size=$(du -sh "$TARGET_DIR" 2>/dev/null | cut -f1)
        log_info "Počet souborů: $file_count"
        log_info "Velikost: $dir_size"

        # Zobrazí package.json verzi pokud existuje
        if [[ -f "$TARGET_DIR/package.json" ]]; then
            local version=$(jq -r '.version' "$TARGET_DIR/package.json" 2>/dev/null)
            local version_code=$(jq -r '.versionCode' "$TARGET_DIR/package.json" 2>/dev/null)
            [[ "$version" != "null" ]] && log_info "Package verze: $version"
            [[ "$version_code" != "null" ]] && log_info "Version kód: $version_code"
        fi
    else
        log_info "Cílový adresář $TARGET_DIR neexistuje"
    fi

    echo ""
}



# Instaluje/aktualizuje Node.js závislosti
install_dependencies() {
    if [[ -f "$TARGET_DIR/package.json" ]]; then
        log_info "Instaluji Node.js závislosti..."
        cd "$TARGET_DIR" || return 1

        if npm install --omit=dev --no-audit --no-fund; then
            log_success "Závislosti úspěšně nainstalovány"
            return 0
        else
            log_error "Instalace závislostí selhala"
            return 1
        fi
    else
        log_info "package.json nenalezen, přeskakuji instalaci závislostí"
        return 0
    fi
}

# Zobrazí změny mezi verzemi
show_changes() {
    if [[ -d "$REPO_DIR" ]]; then
        cd "$REPO_DIR" || return 1

        log_info "=== NEDÁVNÉ ZMĚNY ==="
        git log --oneline -10 --pretty=format:"%C(yellow)%h%C(reset) %C(blue)%cd%C(reset) %s %C(green)(%cn)%C(reset)" --date=format:'%Y-%m-%d %H:%M'
        echo ""
    fi
}

# ===========================================
# 🎯 HLAVNÍ LOGIKA
# ===========================================

main() {
    local mode=${1:-"update"}

    case "$mode" in
        "status"|"s")
            show_status
            ;;
        "check"|"c")
            log_info "Kontroluji dostupné aktualizace..."
            if check_for_updates; then
                log_success "Jsou dostupné nové aktualizace!"
                show_changes
            else
                log_info "Repozitář je již aktuální"
            fi
            ;;
        "backup"|"b")
            log_info "Zálohy nejsou potřeba - vše je uloženo v Git repozitáři"
            ;;
        "update"|"u")
            log_info "🚀 SPOUŠTÍM AKTUALIZACI SOUBORŮ"
            echo "================================================"

            # 1. Zobraz aktuální stav
            show_status

            # 2. Zkontroluj aktualizace
            if ! check_for_updates; then
                log_info "Repozitář je již aktuální. Pokračovat? (y/N)"
                read -r response
                if [[ ! "$response" =~ ^[Yy]$ ]]; then
                    log_info "Aktualizace zrušena"
                    exit 0
                fi
            fi

            # 3. Aktualizuj a synchronizuj
            if ! update_and_sync; then
                log_error "Aktualizace selhala!"
                exit 1
            fi

            # 4. Nainstaluj závislosti
            if ! install_dependencies; then
                log_error "Instalace závislostí selhala!"
                exit 1
            fi

            # 5. Zobraz finální stav
            echo ""
            log_success "🎉 AKTUALIZACE DOKONČENA!"
            show_status
            echo ""
            log_info "Pro spuštění aplikace použijte: cd $TARGET_DIR && ./start.sh"
            ;;
        "help"|"h"|*)
            cat << 'EOF'
=== Update Files Script ===

Použití: ./update-files.sh [MODE]

Dostupné režimy:
  update, u     - Aktualizuje soubory z Git repozitáře (výchozí)
  status, s     - Zobrazí aktuální stav repozitáře a souborů
  check, c      - Zkontroluje dostupné aktualizace
  backup, b     - Informace o zálohách (Git je naše záloha)
  help, h       - Zobrazí tuto nápovědu

Příklady:
  ./update-files.sh           # Aktualizuje soubory
  ./update-files.sh status    # Zobrazí stav
  ./update-files.sh check     # Zkontroluje aktualizace
  ./update-files.sh backup    # Informace o zálohování

Cesty (lze přepsat pomocí proměnných prostředí):
  REPO_DIR="$REPO_DIR"
  TARGET_DIR="$TARGET_DIR"
  SOURCE_SUBFOLDER="$SOURCE_SUBFOLDER"

POZNÁMKA: Tento skript se nachází v ~/ivy/ a používá ~/ivy/git-common.sh
EOF
            ;;
    esac
}

# ===========================================
# 🚀 SPUŠTĚNÍ
# ===========================================

# Kontrola základních závislostí
for cmd in git jq rsync; do
    if ! command -v "$cmd" &>/dev/null; then
        log_error "Požadovaný příkaz '$cmd' není nainstalován!"
        exit 1
    fi
done

# Spuštění hlavní funkce
main "$@"
