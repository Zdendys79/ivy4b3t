#!/bin/bash

# git-common.sh
# Umístění: ~/ivy/git-common.sh
#
# Popis: Společný modul pro Git operace používaný ve více skriptech.
#        Obsahuje funkce pro aktualizaci repozitáře a synchronizaci souborů.

# ===========================================
# 📂 KONFIGURACE
# ===========================================

# Výchozí cesty - lze přepsat před importem modulu
REPO_DIR=${REPO_DIR:-~/git/ivy4b3t}
SOURCE_SUBFOLDER=${SOURCE_SUBFOLDER:-ivy}
TARGET_DIR=${TARGET_DIR:-~/ivy}
BRANCH=${BRANCH:-main}


# ===========================================
# 🔧 POMOCNÉ FUNKCE
# ===========================================

# Logování s časovou značkou
log_info() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO] $1"
}

log_error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] $1" >&2
}

log_success() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [SUCCESS] $1"
}

# Kontrola existence git repozitáře
check_git_repo() {
    if [[ ! -d "$REPO_DIR/.git" ]]; then
        log_error "Adresář $REPO_DIR není git repozitář!"
        return 1
    fi
    return 0
}

# ===========================================
# 📥 HLAVNÍ FUNKCE
# ===========================================

# Aktualizuje Git repozitář na nejnovější verzi
update_git_repo() {
    local repo_dir=${1:-$REPO_DIR}
    local branch=${2:-$BRANCH}

    log_info "Aktualizuji Git repozitář $repo_dir na větev $branch..."

    # Kontrola existence repozitáře
    if ! check_git_repo; then
        return 1
    fi

    # Přejdi do repozitáře
    cd "$repo_dir" || {
        log_error "Nepodařilo se přejít do $repo_dir"
        return 1
    }

    # Git operace
    if ! git fetch origin "$branch" 2>/dev/null; then
        log_error "Nepodařilo se stáhnout změny z origin/$branch"
        return 1
    fi

    if ! git checkout "$branch" 2>/dev/null; then
        log_error "Nepodařilo se přepnout na větev $branch"
        return 1
    fi

    # Pokus o normální pull
    if ! git pull origin "$branch" 2>/dev/null; then
        log_error "Normální pull selhal, zkouším force reset..."
        
        # Force reset na remote větev (řeší divergenci historie)
        if ! git reset --hard "origin/$branch" 2>/dev/null; then
            log_error "Force reset selhal - nepodařilo se aktualizovat větev $branch"
            return 1
        fi
        
        log_info "Úspěšně provedeno force reset na origin/$branch"
    fi

    return 0
}

# Synchronizuje soubory z repozitáře do cílového adresáře
sync_files() {
    local repo_dir=${1:-$REPO_DIR}
    local source_subfolder=${2:-$SOURCE_SUBFOLDER}
    local target_dir=${3:-$TARGET_DIR}

    log_info "Synchronizuji $source_subfolder z $repo_dir do $target_dir..."

    # Kontrola existence zdrojového adresáře
    local source_path="$repo_dir/$source_subfolder"
    if [[ ! -d "$source_path" ]]; then
        log_error "Zdrojový adresář $source_path neexistuje!"
        return 1
    fi

    # Vytvoř cílový adresář pokud neexistuje
    mkdir -p "$target_dir"

    # Rsync s vyloučením specifických souborů/složek
    if rsync -av --delete \
        --exclude node_modules \
        --exclude sql/sql_config.json \
        --exclude .git \
        --exclude .gitignore \
        "$source_path/" "$target_dir/"; then

        return 0
    else
        log_error "Synchronizace souborů selhala"
        return 1
    fi
}

# Kombinuje update_git_repo + sync_files
update_and_sync() {
    local repo_dir=${1:-$REPO_DIR}
    local source_subfolder=${2:-$SOURCE_SUBFOLDER}
    local target_dir=${3:-$TARGET_DIR}
    local branch=${4:-$BRANCH}

    log_info "Spouštím kompletní aktualizaci a synchronizaci..."

    # Aktualizuj repozitář
    if ! update_git_repo "$repo_dir" "$branch"; then
        log_error "Aktualizace repozitáře selhala"
        return 1
    fi

    # Synchronizuj soubory
    if ! sync_files "$repo_dir" "$source_subfolder" "$target_dir"; then
        log_error "Synchronizace souborů selhala"
        return 1
    fi

    return 0
}

# Získá aktuální Git hash a informace o commitu
get_git_info() {
    local repo_dir=${1:-$REPO_DIR}

    cd "$repo_dir" || return 1

    local git_hash=$(git rev-parse HEAD 2>/dev/null)
    local git_short_hash=$(git rev-parse --short=7 HEAD 2>/dev/null)
    local git_branch=$(git branch --show-current 2>/dev/null)
    local git_commit_msg=$(git log -1 --pretty=format:"%s" 2>/dev/null)
    local git_commit_date=$(git log -1 --pretty=format:"%ci" 2>/dev/null)
    
    # Načti verzi z package.json (verze, kterou aplikace skutečně používá)
    local package_version="neznámá"
    if [[ -f "$SOURCE_SUBFOLDER/package.json" ]]; then
        package_version=$(grep '"versionCode"' "$SOURCE_SUBFOLDER/package.json" | sed 's/.*"versionCode": *"\([^"]*\)".*/\1/')
    fi

    echo "Branch: $git_branch"
    echo "Last Commit: $git_commit_msg"
    echo "Commit Date: $git_commit_date"
    echo "Verze klienta: $package_version (používá aplikace)"
}

# Získá aktuální Git hash a informace o commitu ve formátu JSON
get_git_info_json() {
    local repo_dir=${1:-$REPO_DIR}

    cd "$repo_dir" || return 1

    local git_hash=$(git rev-parse HEAD 2>/dev/null)
    local git_short_hash=$(git rev-parse --short=7 HEAD 2>/dev/null)
    local git_branch=$(git branch --show-current 2>/dev/null)
    local git_commit_msg=$(git log -1 --pretty=format:"%s" 2>/dev/null | sed 's/"/\\"/g')
    local git_commit_date=$(git log -1 --pretty=format:"%ci" 2>/dev/null)

    # Sestavení JSON výstupu
    printf '{
      "hash": "%s",
      "short_hash": "%s",
      "branch": "%s",
      "last_commit": "%s",
      "commit_date": "%s"
    }' "$git_hash" "$git_short_hash" "$git_branch" "$git_commit_msg" "$git_commit_date"
}

# Zkontroluje, zda jsou dostupné aktualizace
check_for_updates() {
    local repo_dir=${1:-$REPO_DIR}
    local branch=${2:-$BRANCH}

    cd "$repo_dir" || return 1

    # Stáhni informace o remote větvi bez merge
    git fetch origin "$branch" 2>/dev/null || return 1

    # Porovnej local a remote hash
    local local_hash=$(git rev-parse HEAD)
    local remote_hash=$(git rev-parse "origin/$branch")

    if [[ "$local_hash" != "$remote_hash" ]]; then
        log_info "Dostupné jsou nové aktualizace"
        local commits_behind=$(git rev-list --count HEAD..origin/$branch)
        log_info "Commits za remote větví: $commits_behind"
        return 0  # aktualizace dostupné
    else
        log_info "Repozitář je aktuální"
        return 1  # žádné aktualizace
    fi
}

# ===========================================
# 🎯 VEŘEJNÉ API
# ===========================================

# Export funkcí pro použití v jiných skriptech
export -f log_info log_error log_success
export -f check_git_repo update_git_repo sync_files update_and_sync get_git_info get_git_info_json check_for_updates

# Zobrazí nápovědu k modulu
show_git_common_help() {
    cat << 'EOF'
=== Git Common Module Help ===

Dostupné funkce:
  update_git_repo [repo_dir] [branch]     - Aktualizuje Git repozitář
  sync_files [repo_dir] [subfolder] [target] - Synchronizuje soubory
  update_and_sync [repo] [subfolder] [target] [branch] - Kombinace obou
  get_git_info [repo_dir]                 - Zobrazí Git informace
  check_for_updates [repo_dir] [branch]   - Zkontroluje dostupné aktualizace

Pomocné funkce:
  log_info "zpráva"                       - Logování s časem
  log_error "zpráva"                      - Error log
  log_success "zpráva"                    - Success log
  check_git_repo                          - Kontrola Git repozitáře

Proměnné (lze přepsat):
  REPO_DIR (default: ~/git/ivy4b3t)
  SOURCE_SUBFOLDER (default: ivy)
  TARGET_DIR (default: ~/ivy)
  BRANCH (default: main nebo z config.json)

Příklad použití:
  source ~/ivy/git-common.sh
  update_and_sync
EOF
}
