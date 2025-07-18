# fix-naming-convention.ps1
# File: fix-naming-convention.ps1
# Location: ~/scripts/fix-naming-convention.ps1
#
# Description: PowerShell script to automatically fix snake_case to camelCase
#              in JavaScript files of IVY4B3T project

param(
    [string]$Path = "../../ivy",
    [switch]$DryRun = $false
)

# Function to convert snake_case to camelCase
function Convert-ToCamelCase {
    param([string]$SnakeCaseString)
    
    # Split by _ and convert to camelCase
    $parts = $SnakeCaseString -split '_'
    $result = $parts[0].ToLower()
    
    for ($i = 1; $i -lt $parts.Length; $i++) {
        if ($parts[$i].Length -gt 0) {
            $result += $parts[$i].Substring(0,1).ToUpper() + $parts[$i].Substring(1).ToLower()
        }
    }
    
    return $result
}

# Function to wait for key press without Enter
function Wait-ForKeyPress {
    param([string]$Prompt = "Apply this change? (y=yes, other=no)")
    
    Write-Host $Prompt -NoNewline
    do {
        $key = [System.Console]::ReadKey($true)
    } while ($key.Key -eq 'Enter')
    
    Write-Host $key.KeyChar
    return $key.KeyChar.ToString().ToLower()
}

# Regular expressions for finding functions and methods with snake_case
$patterns = @{
    # export function snake_case_name( OR export async function snake_case_name(
    "ExportFunction" = "(?<=export\s+(?:async\s+)?function\s+)([a-z][a-z0-9]*(_[a-z0-9]+)+)(?=\s*\()"
    
    # function snake_case_name( OR async function snake_case_name(
    "Function" = "(?<=(?:^|\n|\r\n|\r)\s*(?:async\s+)?function\s+)([a-z][a-z0-9]*(_[a-z0-9]+)+)(?=\s*\()"
    
    # async snake_case_name( - async metody v tridach (bez slova function)
    "AsyncMethod" = "(?<=(?:^|\n|\r\n|\r)\s+async\s+)([a-z][a-z0-9]*(_[a-z0-9]+)+)(?=\s*\()"
    
    # snake_case_name: function( OR snake_case_name: async function(
    "ObjectMethod" = "(?<=(?:^|\n|\r\n|\r)\s*)([a-z][a-z0-9]*(_[a-z0-9]+)+)(?=\s*:\s*(?:async\s+)?function\s*\()"
    
    # .snake_case_name( - volání metod (pouze za tečkou)
    "MethodCall" = "(?<=\.)([a-z][a-z0-9]*(_[a-z0-9]+)+)(?=\s*\()"
    
    # import { snake_case_name } from - pouze skutečné importy
    "ImportNamed" = "(?<=import\s*\{\s*)([a-z][a-z0-9]*(_[a-z0-9]+)+)(?=\s*[,}])"
    
    # import { other, snake_case_name } from - další položky v importu
    "ImportContinued" = "(?<=import\s*\{[^}]*,\s*)([a-z][a-z0-9]*(_[a-z0-9]+)+)(?=\s*[,}])"
}

# Find all JS files in project (exclude node_modules)
Write-Host "Searching for JavaScript files in '$Path'..." -ForegroundColor Cyan

$jsFiles = Get-ChildItem -Path $Path -Recurse -Include "*.js" | 
    Where-Object { $_.FullName -notlike "*node_modules*" -and $_.FullName -notlike "*\.git*" }

Write-Host "Found $($jsFiles.Count) JavaScript files" -ForegroundColor Green

if ($jsFiles.Count -eq 0) {
    Write-Host "No JavaScript files found!" -ForegroundColor Red
    exit
}

$totalChanges = 0
$processedFiles = 0

foreach ($file in $jsFiles) {
    $relativePath = Resolve-Path -Relative $file.FullName
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    $fileChanges = 0
    
    Write-Host "`nChecking: $relativePath" -ForegroundColor Yellow
    
    # For each pattern type
    foreach ($patternName in $patterns.Keys) {
        $pattern = $patterns[$patternName]
        $foundMatches = [regex]::Matches($content, $pattern, [System.Text.RegularExpressions.RegexOptions]::Multiline)
        
        foreach ($match in $foundMatches) {
            $originalName = $match.Groups[1].Value
            
            # Skip single-word names (without underscores)
            if ($originalName -notlike "*_*") {
                continue
            }
            
            # Skip already correct camelCase names
            if ($originalName -cmatch "^[a-z][a-zA-Z0-9]*$") {
                continue
            }
            
            $camelCaseName = Convert-ToCamelCase $originalName
            
            # Show change proposal
            Write-Host "`n  Type: $patternName" -ForegroundColor DarkGray
            Write-Host "  Line: $($content.Substring(0, $match.Index).Split("`n").Count)" -ForegroundColor DarkGray
            Write-Host "  Change: $originalName" -ForegroundColor Red -NoNewline
            Write-Host " -> " -NoNewline
            Write-Host "$camelCaseName" -ForegroundColor Green
            
            # Show context (surrounding code)
            $lineStart = [Math]::Max(0, $match.Index - 50)
            $lineEnd = [Math]::Min($content.Length, $match.Index + $match.Length + 50)
            $context = $content.Substring($lineStart, $lineEnd - $lineStart)
            $context = $context -replace "`r`n", " " -replace "`n", " " -replace "\s+", " "
            Write-Host "  Context: ...${context}..." -ForegroundColor DarkCyan
            
            if (-not $DryRun) {
                # Ask for confirmation of this specific change
                $response = Wait-ForKeyPress "  Apply this change? (y=yes, other=no): "
                
                if ($response -eq 'y') {
                    # Perform replacement - only this specific location
                    $beforeMatch = $content.Substring(0, $match.Index)
                    $afterMatch = $content.Substring($match.Index + $match.Length)
                    $newMatchText = $match.Value -replace [regex]::Escape($originalName), $camelCaseName
                    $content = $beforeMatch + $newMatchText + $afterMatch
                    
                    Write-Host "  Applied!" -ForegroundColor Green
                    $fileChanges++
                    $totalChanges++
                } else {
                    Write-Host "  Skipped" -ForegroundColor Gray
                }
            } else {
                Write-Host "  DRY RUN - preview only" -ForegroundColor Magenta
                $totalChanges++
            }
        }
    }
    
    # Save file if changes were made
    if ($fileChanges -gt 0 -and -not $DryRun) {
        try {
            # Preserve original encoding
            [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
            Write-Host "File saved with $fileChanges changes" -ForegroundColor Green
            $processedFiles++
        } catch {
            Write-Host "Error saving file: $($_.Exception.Message)" -ForegroundColor Red
        }
    } elseif ($fileChanges -eq 0) {
        Write-Host "No changes in this file" -ForegroundColor DarkGreen
    }
}

# Summary
Write-Host "`n" + "="*50 -ForegroundColor Cyan
Write-Host "SUMMARY OF FIXES" -ForegroundColor Cyan
Write-Host "="*50 -ForegroundColor Cyan

if ($DryRun) {
    Write-Host "DRY RUN completed" -ForegroundColor Magenta
    Write-Host "Found $totalChanges possible fixes" -ForegroundColor Yellow
    Write-Host "Run without -DryRun to apply changes" -ForegroundColor Blue
} else {
    Write-Host "Total changes applied: $totalChanges" -ForegroundColor Green
    Write-Host "Files modified: $processedFiles" -ForegroundColor Green
    Write-Host "Files checked: $($jsFiles.Count)" -ForegroundColor Blue
}

Write-Host "`nScript completed!" -ForegroundColor Green

# Usage examples:
Write-Host "`nUSAGE EXAMPLES:" -ForegroundColor Yellow
Write-Host "  Preview changes:  .\fix-naming-convention.ps1 -DryRun" -ForegroundColor Gray
Write-Host "  Apply changes:    .\fix-naming-convention.ps1" -ForegroundColor Gray
Write-Host "  Other folder:     .\fix-naming-convention.ps1 -Path '..\other-folder'" -ForegroundColor Gray
Write-Host "`nSearching in: $(Resolve-Path $Path -ErrorAction SilentlyContinue)" -ForegroundColor Blue