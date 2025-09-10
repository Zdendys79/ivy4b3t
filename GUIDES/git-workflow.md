# Git Workflow Guide - IVY4B3T

## KRITICKÉ PRAVIDLO: VŽDY PUSH PO COMMITU!

## Commit Options

```bash
# PREFEROVANÝ způsob - commit script (už obsahuje push):
./commit.sh commit_message.txt

# ALTERNATIVA - MCP Git nástroje (nezapomenout push):
mcp__git__git_add({ files: "." })
mcp__git__git_commit({ message: "commit text" })
mcp__git__git_push()
```

## Git operace přes MCP

```javascript
// Nastavení pracovní složky pro Git session
mcp__git__git_set_working_dir({ path: "/absolute/path/to/repo" })

// Základní Git operace
mcp__git__git_status()                           // git status
mcp__git__git_log({ maxCount: 5 })              // git log --oneline -5
mcp__git__git_add({ files: "." })               // git add . - VŽDY POUŽÍVEJ TOTO!
mcp__git__git_commit({ message: "commit text" }) // git commit -m
mcp__git__git_push()                             // git push IHNED PO COMMITU!
mcp__git__git_branch({ mode: "list" })          // git branch -a
```

## GIT ADD PRAVIDLO
- **VŽDY používej `mcp__git__git_add({ files: "." })`**
- **NIKDY nepřidávaj soubory jednotlivě**
- **git add . je jednodušší a rychlejší**

## Commit Message Rules - STRUČNOST!

- **JEDNA VĚTA:** Stručný popis řešeného problému
- **MAX JEDNA VĚTA NA SOUBOR:** Co bylo v daném souboru změněno
- **ŽÁDNÉ ZDLOUHAVÉ KOMENTÁŘE** - commit není dokumentace
- **Kód musí být sám o sobě srozumitelný** - ne commit zpráva

## Systémové Proměnné
- `$MYSQL_HOST`, `$MYSQL_PORT`, `$MYSQL_USER`, `$MYSQL_PASSWORD`, `$MYSQL_DATABASE`
- `$GIT_TOKEN`, `$GIT_USERNAME`
- **NIKDY neukládat hesla nebo tokeny do souborů!**

## Verze a Commit Hooks - KRITICKÉ POCHOPENÍ

**Deployment struktura:**
- **Vývojový PC:** `/home/remotes/ivy4b3t/ivy` - celý projekt pro vývoj
- **VM produkce:** `/home/remotes/ivy` - jen složka ivy pro běh aplikace
- **Git synchronizace:** VM stahuje z `/home/remotes/git/ivy4b3t` do `/home/remotes/ivy`

**Verze systém:**
- **Short Hash** v start scriptu = aktuální git commit hash
- **Verze klienta** = hash z PŘEDCHOZÍHO commitu (zapisuje se při commit hooks)
- **LOGICKÁ NEMOŽNOST:** Pre-commit hook NEMŮŽE zapsat hash commitu, který teprve vzniká!
- **ŘEŠENÍ:** Pre-commit hook ukládá hash PŘEDCHOZÍHO commitu do package.json a databáze
- **Package.json** je součástí commitu → obsahuje verzi předchozího commitu
- **Verze klienta je VŽDY o jeden commit pozadu za skutečným stavem**
- **Toto je SPRÁVNÉ chování** - není to chyba, je to jediný možný způsob!

## PROCES COMMIT HOOKS
1. Pre-commit hook: Načte aktuální HEAD hash (předchozí commit)
2. Pre-commit hook: Zapíše tento hash do package.json a databáze
3. Git commit: Vytvoří NOVÝ commit obsahující aktualizovaný package.json
4. Výsledek: Package.json obsahuje hash předchozího commitu (o 1 pozadu)