# Update-NodeEnv.ps1 – plně kompatibilní s NVM for Windows

Write-Host "Kontroluji, zda je nainstalovaný NVM for Windows..."

if (!(Get-Command nvm.exe -ErrorAction SilentlyContinue)) {
    Write-Host "NVM není nainstalován. Stahuji instalátor..."
    $installer = "$env:TEMP\nvm-setup.exe"
    Invoke-WebRequest -Uri "https://github.com/coreybutler/nvm-windows/releases/latest/download/nvm-setup.exe" -OutFile $installer
    Start-Process $installer -Wait

    Write-Host "`nInstalace NVM dokončena. Zavři tento terminál a spusť skript znovu."
    exit
}

Write-Host "Instaluji nejnovější LTS verzi Node.js přes NVM..."
nvm install lts
nvm use lts

# Nutné pro aktuální relaci:
$env:Path = "$env:ProgramFiles\nodejs;$env:AppData\npm;" + $env:Path

Write-Host "Aktualizuji npm na nejnovější verzi..."
npm install -g npm

Write-Host ""
Write-Host "--------------------------------------"
Write-Host "Node.js verze: $(node -v)"
Write-Host "npm verze:     $(npm -v)"
Write-Host "--------------------------------------"
