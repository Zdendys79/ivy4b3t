# function-usage-report.ps1
# File: function-usage-report.ps1
# Location: ~/scripts/function-usage-report.ps1
#
# Description: Analyzes JavaScript files to find function definitions and their usage
#              Generates XML report showing used/unused functions

param(
    [string]$Path = "../../ivy",
    [string]$OutputFile = "function-usage-report.xml",
    [switch]$IncludePrivate = $false,
    [switch]$Verbose = $false
)

# Function to extract function name from various definition patterns
function Get-FunctionName {
    param([string]$FunctionDefinition, [string]$PatternType)
    
    switch ($PatternType) {
        "ExportFunction" { 
            if ($FunctionDefinition -match "export\s+(?:async\s+)?function\s+([a-zA-Z_][a-zA-Z0-9_]*)") {
                return $matches[1]
            }
        }
        "Function" { 
            if ($FunctionDefinition -match "(?:async\s+)?function\s+([a-zA-Z_][a-zA-Z0-9_]*)") {
                return $matches[1]
            }
        }
        "AsyncMethod" { 
            if ($FunctionDefinition -match "async\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(") {
                return $matches[1]
            }
        }
        "ObjectMethod" { 
            if ($FunctionDefinition -match "([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(?:async\s+)?function") {
                return $matches[1]
            }
        }
        "ArrowFunction" {
            if ($FunctionDefinition -match "(?:const|let|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(?:async\s+)?\(") {
                return $matches[1]
            }
        }
        "ClassMethod" {
            if ($FunctionDefinition -match "(?:async\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)\s*\{") {
                return $matches[1]
            }
        }
        default { return $null }
    }
    return $null
}

# Function to get line number of a match
function Get-LineNumber {
    param([string]$Content, [int]$Position)
    return $Content.Substring(0, $Position).Split("`n").Count
}

# Function to get context around a match
function Get-Context {
    param([string]$Content, [int]$Position, [int]$ContextLength = 60)
    
    $start = [Math]::Max(0, $Position - $ContextLength)
    $end = [Math]::Min($Content.Length, $Position + $ContextLength)
    $context = $Content.Substring($start, $end - $start)
    $context = $context -replace "`r`n", " " -replace "`n", " " -replace "\s+", " "
    return "...$context..."
}

# Patterns for finding function definitions
$definitionPatterns = @{
    # export function name() or export async function name()
    "ExportFunction" = "export\s+(?:async\s+)?function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\("
    
    # function name() or async function name() 
    "Function" = "(?:^|\n|\r\n|\r)\s*(?:async\s+)?function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\("
    
    # async name() in classes
    "AsyncMethod" = "(?:^|\n|\r\n|\r)\s+async\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\("
    
    # name: function() or name: async function()
    "ObjectMethod" = "(?:^|\n|\r\n|\r)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(?:async\s+)?function\s*\("
    
    # const name = () => or let name = async () =>
    "ArrowFunction" = "(?:const|let|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>"
    
    # Class methods: methodName() { 
    "ClassMethod" = "(?:^|\n|\r\n|\r)\s+(?:async\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)\s*\{"
}

# Usage patterns - how functions might be called
$usagePatterns = @{
    # Direct calls: functionName(
    "DirectCall" = "([a-zA-Z_][a-zA-Z0-9_]*)\s*\("
    
    # Method calls: .methodName(
    "MethodCall" = "\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\("
    
    # Import usage: import { functionName }
    "ImportUsage" = "import\s*\{\s*[^}]*([a-zA-Z_][a-zA-Z0-9_]*)[^}]*\}"
    
    # Export usage: export { functionName }
    "ExportUsage" = "export\s*\{\s*[^}]*([a-zA-Z_][a-zA-Z0-9_]*)[^}]*\}"
    
    # Assignment: const x = functionName
    "Assignment" = "=\s*([a-zA-Z_][a-zA-Z0-9_]*)(?:\s|;|,|\))"
}

Write-Host "Analyzing JavaScript files in '$Path'..." -ForegroundColor Cyan

# Find all JS files
$jsFiles = Get-ChildItem -Path $Path -Recurse -Include "*.js" | 
    Where-Object { $_.FullName -notlike "*node_modules*" -and $_.FullName -notlike "*\.git*" }

Write-Host "Found $($jsFiles.Count) JavaScript files" -ForegroundColor Green

# Data structures to store results
$allFunctions = @()
$allUsages = @()

# Step 1: Find all function definitions
Write-Host "`nStep 1: Finding function definitions..." -ForegroundColor Yellow

foreach ($file in $jsFiles) {
    $relativePath = Resolve-Path -Relative $file.FullName
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    
    if ($Verbose) {
        Write-Host "  Scanning: $relativePath" -ForegroundColor DarkGray
    }
    
    foreach ($patternName in $definitionPatterns.Keys) {
        $pattern = $definitionPatterns[$patternName]
        $foundMatches = [regex]::Matches($content, $pattern, [System.Text.RegularExpressions.RegexOptions]::Multiline)
        
        foreach ($match in $foundMatches) {
            $functionName = $match.Groups[1].Value
            
            # Skip common patterns that aren't real functions
            if ($functionName -in @('if', 'for', 'while', 'switch', 'catch', 'return', 'new')) {
                continue
            }
            
            # Skip private functions if not requested
            if (-not $IncludePrivate -and $functionName.StartsWith('_')) {
                continue
            }
            
            $functionInfo = [PSCustomObject]@{
                Name = $functionName
                File = $relativePath
                Type = $patternName
                Line = Get-LineNumber $content $match.Index
                Context = Get-Context $content $match.Index
                IsExported = ($patternName -eq "ExportFunction" -or $content -match "export\s*\{\s*[^}]*$functionName")
                UsageCount = 0
                UsedInFiles = @()
            }
            
            $allFunctions += $functionInfo
        }
    }
}

Write-Host "Found $($allFunctions.Count) function definitions" -ForegroundColor Green

# Step 2: Find all function usages
Write-Host "`nStep 2: Finding function usages..." -ForegroundColor Yellow

foreach ($file in $jsFiles) {
    $relativePath = Resolve-Path -Relative $file.FullName
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    
    if ($Verbose) {
        Write-Host "  Scanning usages in: $relativePath" -ForegroundColor DarkGray
    }
    
    foreach ($patternName in $usagePatterns.Keys) {
        $pattern = $usagePatterns[$patternName]
        $foundMatches = [regex]::Matches($content, $pattern, [System.Text.RegularExpressions.RegexOptions]::Multiline)
        
        foreach ($match in $foundMatches) {
            $usedName = $match.Groups[1].Value
            
            # Skip common words and keywords
            if ($usedName -in @('if', 'for', 'while', 'switch', 'catch', 'return', 'new', 'console', 'require', 'import', 'export', 'default', 'class', 'extends')) {
                continue
            }
            
            $usageInfo = [PSCustomObject]@{
                Name = $usedName
                File = $relativePath
                Type = $patternName
                Line = Get-LineNumber $content $match.Index
                Context = Get-Context $content $match.Index
            }
            
            $allUsages += $usageInfo
        }
    }
}

Write-Host "Found $($allUsages.Count) potential function usages" -ForegroundColor Green

# Step 3: Match definitions with usages
Write-Host "`nStep 3: Matching definitions with usages..." -ForegroundColor Yellow

foreach ($func in $allFunctions) {
    $usages = $allUsages | Where-Object { $_.Name -eq $func.Name -and $_.File -ne $func.File }
    $func.UsageCount = $usages.Count
    $func.UsedInFiles = ($usages | Select-Object -ExpandProperty File -Unique)
}

# Categorize functions
$usedFunctions = $allFunctions | Where-Object { $_.UsageCount -gt 0 }
$unusedFunctions = $allFunctions | Where-Object { $_.UsageCount -eq 0 }
$exportedFunctions = $allFunctions | Where-Object { $_.IsExported }
$privateFunctions = $allFunctions | Where-Object { -not $_.IsExported }

# Step 4: Generate XML report
Write-Host "`nStep 4: Generating XML report..." -ForegroundColor Yellow

$xmlContent = @"
<?xml version="1.0" encoding="UTF-8"?>
<FunctionUsageReport>
    <GeneratedAt>$(Get-Date -Format "yyyy-MM-dd HH:mm:ss")</GeneratedAt>
    <ProjectPath>$Path</ProjectPath>
    <Summary>
        <TotalFiles>$($jsFiles.Count)</TotalFiles>
        <TotalFunctions>$($allFunctions.Count)</TotalFunctions>
        <UsedFunctions>$($usedFunctions.Count)</UsedFunctions>
        <UnusedFunctions>$($unusedFunctions.Count)</UnusedFunctions>
        <ExportedFunctions>$($exportedFunctions.Count)</ExportedFunctions>
        <PrivateFunctions>$($privateFunctions.Count)</PrivateFunctions>
    </Summary>
    
    <UnusedFunctions>
"@

foreach ($func in $unusedFunctions) {
    $xmlContent += @"

        <Function>
            <Name>$($func.Name)</Name>
            <File>$($func.File)</File>
            <Type>$($func.Type)</Type>
            <Line>$($func.Line)</Line>
            <IsExported>$($func.IsExported)</IsExported>
            <Context><![CDATA[$($func.Context)]]></Context>
        </Function>
"@
}

$xmlContent += @"

    </UnusedFunctions>
    
    <UsedFunctions>
"@

foreach ($func in $usedFunctions) {
    $xmlContent += @"

        <Function>
            <Name>$($func.Name)</Name>
            <File>$($func.File)</File>
            <Type>$($func.Type)</Type>
            <Line>$($func.Line)</Line>
            <IsExported>$($func.IsExported)</IsExported>
            <UsageCount>$($func.UsageCount)</UsageCount>
            <UsedInFiles>$($func.UsedInFiles -join '; ')</UsedInFiles>
            <Context><![CDATA[$($func.Context)]]></Context>
        </Function>
"@
}

$xmlContent += @"

    </UsedFunctions>
    
    <AllFunctionsByFile>
"@

$fileGroups = $allFunctions | Group-Object -Property File
foreach ($group in $fileGroups) {
    $xmlContent += @"

        <File path="$($group.Name)">
"@
    foreach ($func in $group.Group) {
        $xmlContent += @"

            <Function name="$($func.Name)" type="$($func.Type)" line="$($func.Line)" used="$($func.UsageCount -gt 0)" exported="$($func.IsExported)" />
"@
    }
    $xmlContent += @"

        </File>
"@
}

$xmlContent += @"

    </AllFunctionsByFile>
</FunctionUsageReport>
"@

# Save XML report
$xmlContent | Out-File -FilePath $OutputFile -Encoding UTF8
Write-Host "XML report saved to: $OutputFile" -ForegroundColor Green

# Display summary
Write-Host "`n" + "="*60 -ForegroundColor Cyan
Write-Host "FUNCTION USAGE ANALYSIS SUMMARY" -ForegroundColor Cyan
Write-Host "="*60 -ForegroundColor Cyan

Write-Host "Total JavaScript files analyzed: $($jsFiles.Count)" -ForegroundColor Blue
Write-Host "Total functions found: $($allFunctions.Count)" -ForegroundColor Blue
Write-Host ""
Write-Host "Used functions: $($usedFunctions.Count)" -ForegroundColor Green
Write-Host "Unused functions: $($unusedFunctions.Count)" -ForegroundColor Red
Write-Host ""
Write-Host "Exported functions: $($exportedFunctions.Count)" -ForegroundColor Yellow
Write-Host "Private functions: $($privateFunctions.Count)" -ForegroundColor DarkGray

if ($unusedFunctions.Count -gt 0) {
    Write-Host "`nUNUSED FUNCTIONS:" -ForegroundColor Red
    foreach ($func in $unusedFunctions | Sort-Object File, Name) {
        $status = if ($func.IsExported) { "EXPORTED" } else { "private" }
        Write-Host "  $($func.Name) in $($func.File):$($func.Line) [$status]" -ForegroundColor DarkRed
    }
}

Write-Host "`nDetailed report saved to: $OutputFile" -ForegroundColor Green
Write-Host "`nUSAGE EXAMPLES:" -ForegroundColor Yellow
Write-Host "  Generate report:           .\function-usage-report.ps1" -ForegroundColor Gray
Write-Host "  Include private functions: .\function-usage-report.ps1 -IncludePrivate" -ForegroundColor Gray
Write-Host "  Verbose output:            .\function-usage-report.ps1 -Verbose" -ForegroundColor Gray
Write-Host "  Custom output file:        .\function-usage-report.ps1 -OutputFile 'my-report.xml'" -ForegroundColor Gray