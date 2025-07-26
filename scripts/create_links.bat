@echo off
:: Soubor: create-links.bat
:: Vytvoří potřebné symbolické linky pro projekt ivy4b3t
:: - web => Apache server
:: - scripts => Syncthing složka s pomocnými skripty
:: - git hooky pre-commit, post-commit

:: Kontrola oprávnění správce
openfiles >nul 2>&1
if %errorlevel% neq 0 (
    echo Tento skript musí být spuštěn jako správce.
    echo Znovu spouštím se zvýšenými právy...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

:: Vytvoření symlinků
echo Vytvářím symbolické linky...

:: Link na web složku (pro Apache)
mklink /J e:\B3projekty\ivy4b3t\web e:\B3-VPS00.website\ivy

:: Link na scripts složku (Syncthing VM)
mklink /J e:\B3projekty\ivy4b3t\scripts e:\B3.puppeteer\scripts

:: Git hook pre-commit
mklink e:\B3projekty\ivy4b3t\.git\hooks\pre-commit e:\B3.puppeteer\scripts\pre-commit

:: Git hook post-commit
mklink e:\B3projekty\ivy4b3t\.git\hooks\post-commit e:\B3.puppeteer\scripts\post-commit

echo Hotovo.
pause
