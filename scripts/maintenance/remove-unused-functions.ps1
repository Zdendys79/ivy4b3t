# remove-unused-functions.ps1
# File: remove-unused-functions.ps1
# Location: ~/scripts/maintenance/remove-unused-functions.ps1
#
# Description: Interactive tool for removing unused functions identified by function-usage-report.xml
#              Performs double-check search and asks user confirmation for each function

param(
    [string]$ReportPath = "../function-usage-report.xml",
    [string]$ProjectPath = "../../ivy",
    [switch]$DryRun = $false,
    [switch]$AutoConfirm = $false
)

# Global counters
$script:processedCount = 0
$script:removedCount = 0
$script:skippedCount = 0
$script:errorCount = 0

# Function to search for function name in all JS files
function Search-FunctionInProject {
    param(
        [string]$FunctionName,
        [string]$OriginalFile,
        [string]$ProjectPath
    )
    
    Write-Host "    🔍 Double-checking usage of '$FunctionName'..." -ForegroundColor Cyan
    
    $jsFiles = Get-ChildItem -Path $ProjectPath -Recurse -Include "*.js" | 
        Where-Object { $_.FullName -notlike "*node_modules*" -and $_.FullName -notlike "*\.git*" }
    
    $foundInFiles = @()
    
    foreach ($file in $jsFiles) {
        try {
            $content = Get-Content $file.FullName -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
            if ($content -and $content -match "\b$([regex]::Escape($FunctionName))\b") {
                $relativePath = Resolve-Path -Relative $file.FullName
                
                # Skip if it's the original file (where function is defined)
                if ($relativePath -ne $OriginalFile) {
                    $foundInFiles += $relativePath
                }
            }
        }
        catch {
            Write-Warning "Error reading file $($file.FullName): $($_.Exception.Message)"
        }
    }
    
    return $foundInFiles
}

# Function to remove function from file
function Remove-FunctionFromFile {
    param(
        [string]$FilePath,
        [string]$FunctionName,
        [int]$LineNumber,
        [string]$FunctionType
    )
    
    try {
        $content = Get-Content $FilePath -Encoding UTF8
        Write-Host "    📝 Analyzing function structure..." -ForegroundColor Yellow
        
        # Find function start and end
        $startLine = $LineNumber - 1  # Convert to 0-based index
        $endLine = $startLine
        
        # Determine function boundaries based on type
        switch ($FunctionType) {
            "ExportFunction" {
                $endLine = Find-FunctionEnd $content $startLine "export function"
            }
            "Function" {
                $endLine = Find-FunctionEnd $content $startLine "function"
            }
            "AsyncMethod" {
                $endLine = Find-FunctionEnd $content $startLine "async method"
            }
            "ClassMethod" {
                $endLine = Find-FunctionEnd $content $startLine "class method"
            }
            "ArrowFunction" {
                $endLine = Find-ArrowFunctionEnd $content $startLine
            }
            "ObjectMethod" {
                $endLine = Find-FunctionEnd $content $startLine "object method"
            }
            default {
                $endLine = Find-FunctionEnd $content $startLine "generic"
            }
        }
        
        if ($endLine -eq -1) {
            Write-Warning "Could not determine function end for $FunctionName"
            return $false
        }
        
        Write-Host "    📍 Function spans lines $($startLine + 1) to $($endLine + 1)" -ForegroundColor Gray
        
        if (!$DryRun) {
            # Remove the function lines
            $newContent = @()
            
            for ($i = 0; $i -lt $content.Count; $i++) {
                if ($i -lt $startLine -or $i -gt $endLine) {
                    $newContent += $content[$i]
                }
            }
            
            # Write back to file
            $newContent | Set-Content $FilePath -Encoding UTF8
            
            $removedLines = $endLine - $startLine + 1
            Write-Host "    ✅ Removed $removedLines lines from $FilePath" -ForegroundColor Green
        } else {
            $removedLines = $endLine - $startLine + 1
            Write-Host "    🔍 [DRY RUN] Would remove $removedLines lines from $FilePath" -ForegroundColor Blue
        }
        
        return $true
        
    } catch {
        Write-Error "Error removing function from ${FilePath}: $($_.Exception.Message)"
        return $false
    }
}

# Function to find the end of a function
function Find-FunctionEnd {
    param(
        [string[]]$Content,
        [int]$StartLine,
        [string]$FunctionType
    )
    
    $braceCount = 0
    $inFunction = $false
    
    for ($i = $StartLine; $i -lt $Content.Count; $i++) {
        $line = $Content[$i]
        
        # Look for opening brace
        $openBraces = ($line.ToCharArray() | Where-Object { $_ -eq '{' }).Count
        $closeBraces = ($line.ToCharArray() | Where-Object { $_ -eq '}' }).Count
        
        $braceCount += $openBraces - $closeBraces
        
        if ($openBraces -gt 0) {
            $inFunction = $true
        }
        
        # If we've closed all braces and we're in a function, we found the end
        if ($inFunction -and $braceCount -eq 0) {
            return $i
        }
    }
    
    return -1
}

# Function to find the end of an arrow function
function Find-ArrowFunctionEnd {
    param(
        [string[]]$Content,
        [int]$StartLine
    )
    
    $line = $Content[$StartLine]
    
    # Check if it's a simple one-liner arrow function
    if ($line -match "=>\s*[^{]") {
        return $StartLine
    }
    
    # Otherwise use the same logic as regular functions
    return Find-FunctionEnd $Content $StartLine "arrow function"
}

# Function to get user confirmation for function removal
function Get-UserConfirmation {
    param(
        [string]$FunctionName,
        [string]$FilePath,
        [string]$LineNumber,
        [string]$FunctionType,
        [string[]]$FoundInFiles
    )
    
    if ($AutoConfirm -and $FoundInFiles.Count -eq 0) {
        Write-Host "    🤖 Auto-confirming removal (no usage found)" -ForegroundColor Magenta
        return $true
    }
    
    Write-Host "    📄 File: $FilePath" -ForegroundColor White
    Write-Host "    📍 Line: $LineNumber" -ForegroundColor White
    Write-Host "    🔧 Type: $FunctionType" -ForegroundColor White
    
    if ($FoundInFiles.Count -gt 0) {
        Write-Host "    ⚠️  Found potential usage in:" -ForegroundColor Red
        foreach ($file in $FoundInFiles) {
            Write-Host "        - $file" -ForegroundColor Red
        }
        Write-Host "    💡 Please verify these are not false positives before removing" -ForegroundColor Yellow
    } else {
        Write-Host "    ✅ No usage found in project" -ForegroundColor Green
    }
    
    # Get user input
    do {
        Write-Host "    Remove function '$FunctionName'? " -ForegroundColor White -NoNewline
        Write-Host "[y]es/[n]o/[q]uit: " -ForegroundColor White -NoNewline
        $key = [System.Console]::ReadKey($true)
        Write-Host $key.KeyChar
        
        switch ($key.KeyChar.ToString().ToLower()) {
            'y' {
                return $true
            }
            'n' {
                return $false
            }
            'q' {
                Write-Host "    🛑 User requested to quit. Exiting..." -ForegroundColor Red
                exit 0
            }
            default {
                # Invalid key, continue loop
            }
        }
    } while ($true)
}

# Main function
function Main {
    Write-Host "🧹 UNUSED FUNCTION REMOVER" -ForegroundColor Cyan -BackgroundColor DarkBlue
    Write-Host "=" * 50 -ForegroundColor Cyan
    
    # Check if report file exists
    if (-not (Test-Path $ReportPath)) {
        Write-Error "Report file not found: $ReportPath"
        Write-Host "Run function-usage-report.ps1 first to generate the report."
        exit 1
    }
    
    # Load XML report
    Write-Host "📖 Loading report from: $ReportPath" -ForegroundColor Yellow
    try {
        [xml]$report = Get-Content $ReportPath -Encoding UTF8
    } catch {
        Write-Error "Failed to load XML report: $($_.Exception.Message)"
        exit 1
    }
    
    $unusedFunctions = $report.FunctionUsageReport.UnusedFunctions.Function
    $totalFunctions = $unusedFunctions.Count
    
    Write-Host "📊 Found $totalFunctions unused functions to process" -ForegroundColor Green
    
    if ($DryRun) {
        Write-Host "🔍 DRY RUN MODE - No files will be modified" -ForegroundColor Blue
    }
    
    if ($AutoConfirm) {
        Write-Host "🤖 AUTO CONFIRM MODE - Will remove functions without usage" -ForegroundColor Magenta
    }
    
    Write-Host ""
    
    # Process each unused function
    foreach ($func in $unusedFunctions) {
        $script:processedCount++
        
        Write-Host "[$script:processedCount/$totalFunctions] " -ForegroundColor Blue -NoNewline
        Write-Host "Processing: $($func.n)" -ForegroundColor White
        
        # Double-check if function is really unused
        $foundInFiles = Search-FunctionInProject -FunctionName $func.n -OriginalFile $func.File -ProjectPath $ProjectPath
        
        # Get user confirmation
        $shouldRemove = Get-UserConfirmation -FunctionName $func.n -FilePath $func.File -LineNumber $func.Line -FunctionType $func.Type -FoundInFiles $foundInFiles
        
        if ($shouldRemove) {
            $success = Remove-FunctionFromFile -FilePath $func.File -FunctionName $func.n -LineNumber ([int]$func.Line) -FunctionType $func.Type
            
            if ($success) {
                $script:removedCount++
            } else {
                $script:errorCount++
            }
        } else {
            $script:skippedCount++
            Write-Host "    ⏭️  Skipped" -ForegroundColor Yellow
        }
        
        Write-Host ""
    }
    
    # Final summary
    Write-Host "🏁 REMOVAL SUMMARY" -ForegroundColor Cyan -BackgroundColor DarkBlue
    Write-Host "=" * 30 -ForegroundColor Cyan
    Write-Host "Processed: $script:processedCount" -ForegroundColor Blue
    Write-Host "Removed:   $script:removedCount" -ForegroundColor Green
    Write-Host "Skipped:   $script:skippedCount" -ForegroundColor Yellow
    Write-Host "Errors:    $script:errorCount" -ForegroundColor Red
    
    if ($script:removedCount -gt 0 -and !$DryRun) {
        Write-Host ""
        Write-Host "✅ Successfully removed $script:removedCount unused functions!" -ForegroundColor Green
        Write-Host "💡 Consider running the analysis again to verify changes." -ForegroundColor Cyan
    }
}

# Run the main function
Main
