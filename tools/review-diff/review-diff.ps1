[CmdletBinding()]
param(
    [string]$RepoRoot,
    [string]$Base = "HEAD",
    [string]$Head,

    [ValidateSet("text", "json")]
    [string]$Format = "text",

    [string]$Out
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    $RepoRoot = Join-Path $PSScriptRoot "..\.."
}

function Resolve-RepositoryRoot {
    param([string]$Path)

    try {
        $resolvedPath = (Resolve-Path -LiteralPath $Path).Path
    }
    catch {
        throw "Repository root does not exist: $Path"
    }

    $insideWorkTree = & git -C $resolvedPath rev-parse --is-inside-work-tree 2>&1
    if ($LASTEXITCODE -ne 0 -or $insideWorkTree -ne "true") {
        throw "Path is not a Git worktree: $resolvedPath"
    }

    return $resolvedPath
}

function Assert-GitRevision {
    param(
        [string]$RepositoryRoot,
        [string]$Revision
    )

    & git -C $RepositoryRoot rev-parse --verify --quiet `
        "$Revision^{commit}" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Git revision does not resolve to a commit: $Revision"
    }
}

function Test-PathInsideRepository {
    param(
        [string]$RepositoryRoot,
        [string]$CandidatePath
    )

    $rootWithSeparator = $RepositoryRoot.TrimEnd("\", "/") +
        [System.IO.Path]::DirectorySeparatorChar
    return $CandidatePath.StartsWith(
        $rootWithSeparator,
        [System.StringComparison]::OrdinalIgnoreCase
    )
}

function Resolve-SafeOutputPath {
    param(
        [string]$RepositoryRoot,
        [string]$RequestedPath
    )

    if ([System.IO.Path]::IsPathRooted($RequestedPath)) {
        $candidatePath = [System.IO.Path]::GetFullPath($RequestedPath)
    }
    else {
        $candidatePath = [System.IO.Path]::GetFullPath(
            (Join-Path $RepositoryRoot $RequestedPath)
        )
    }

    if (-not (Test-PathInsideRepository $RepositoryRoot $candidatePath)) {
        throw "Output path must stay inside the repository."
    }
    if (Test-Path -LiteralPath $candidatePath) {
        throw "Output path already exists: $candidatePath"
    }

    $parentPath = Split-Path -Parent $candidatePath
    if (-not (Test-Path -LiteralPath $parentPath -PathType Container)) {
        throw "Output directory does not exist: $parentPath"
    }

    return $candidatePath
}

function Get-ChangeArea {
    param([string]$Path)

    $normalizedPath = $Path.Replace("\", "/")
    switch -Regex ($normalizedPath) {
        "^mobile-app/" { return "mobile" }
        "^(AGENTS\.md|agent-context/|context/|playbooks/|templates/|tools/)" {
            return "agent-workspace"
        }
        "^docs/(privacy-and-security|data-model|synchronization|extensibility)" {
            return "health-contracts"
        }
        "^docs/" { return "documentation" }
        "^\.github/workflows/" { return "automation" }
        "^(SECURITY|VISION|README)\.md$" { return "project-policy" }
        default { return "other" }
    }
}

function New-Finding {
    param(
        [string]$Severity,
        [string]$Code,
        [string]$Message
    )

    return [PSCustomObject]@{
        severity = $Severity
        code = $Code
        message = $Message
    }
}

try {
    $repositoryRoot = Resolve-RepositoryRoot $RepoRoot
    Assert-GitRevision $repositoryRoot $Base
    if ($Head) {
        Assert-GitRevision $repositoryRoot $Head
    }
}
catch {
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 10
}

if ($Head) {
    $range = "$Base...$Head"
    $nameStatusLines = @(
        & git -C $repositoryRoot diff --name-status $range 2>&1
    )
    $numStatLines = @(
        & git -C $repositoryRoot diff --numstat $range 2>&1
    )
    $reviewMode = "commit-range"
}
else {
    $nameStatusLines = @(
        & git -C $repositoryRoot diff --name-status $Base -- 2>&1
    )
    $numStatLines = @(
        & git -C $repositoryRoot diff --numstat $Base -- 2>&1
    )
    $untrackedPaths = @(
        & git -C $repositoryRoot ls-files --others --exclude-standard
    )
    foreach ($untrackedPath in $untrackedPaths) {
        $nameStatusLines += "A`t$untrackedPath"
        $lineCount = @(
            Get-Content -LiteralPath (Join-Path $repositoryRoot $untrackedPath)
        ).Count
        $numStatLines += "$lineCount`t0`t$untrackedPath"
    }
    $reviewMode = "working-tree"
}

if ($LASTEXITCODE -ne 0) {
    [Console]::Error.WriteLine("Git diff failed.")
    exit 10
}

$statsByPath = @{}
foreach ($line in $numStatLines) {
    $parts = $line -split "`t", 3
    if ($parts.Count -ne 3) {
        continue
    }

    $statsByPath[$parts[2]] = [PSCustomObject]@{
        additions = $(if ($parts[0] -eq "-") { $null } else {
            [int]$parts[0]
        })
        deletions = $(if ($parts[1] -eq "-") { $null } else {
            [int]$parts[1]
        })
    }
}

$files = New-Object System.Collections.Generic.List[object]
foreach ($line in $nameStatusLines) {
    if ([string]::IsNullOrWhiteSpace($line)) {
        continue
    }

    $parts = $line -split "`t"
    $status = $parts[0]
    $path = $parts[$parts.Count - 1]
    $stats = $statsByPath[$path]
    $files.Add([PSCustomObject]@{
        status = $status
        path = $path
        area = Get-ChangeArea $path
        additions = $(if ($stats) { $stats.additions } else { $null })
        deletions = $(if ($stats) { $stats.deletions } else { $null })
    })
}

$changedPaths = @($files | ForEach-Object { $_.path })
$findings = New-Object System.Collections.Generic.List[object]

$healthBoundaryChanged = @(
    $changedPaths |
    Where-Object {
        $_ -match "(?i)(data-model|synchronization|privacy|permission|adapter|source|destination|health)"
    }
).Count -gt 0
if ($healthBoundaryChanged) {
    $findings.Add(
        (New-Finding `
            "high" `
            "health-boundary" `
            "Review normalization, permission, retry, provenance, and sensitive-data behavior.")
    )
}

$dependencyChanged = @(
    $changedPaths |
    Where-Object {
        $_ -match "(?i)(package(-lock)?\.json|yarn\.lock|pnpm-lock\.yaml)$"
    }
).Count -gt 0
if ($dependencyChanged) {
    $findings.Add(
        (New-Finding `
            "medium" `
            "dependency-change" `
            "Review licensing, security, bundle size, and platform impact.")
    )
}

$codeChanged = @(
    $changedPaths |
    Where-Object { $_ -match "(?i)\.(ts|tsx|js|jsx|swift|kt|java)$" }
).Count -gt 0
$testsChanged = @(
    $changedPaths |
    Where-Object { $_ -match "(?i)(test|spec|__tests__)" }
).Count -gt 0
if ($codeChanged -and -not $testsChanged) {
    $findings.Add(
        (New-Finding `
            "medium" `
            "test-gap" `
            "Implementation files changed without an accompanying test change.")
    )
}

$agentWorkspaceChanged = @(
    $files |
    Where-Object { $_.area -eq "agent-workspace" }
).Count -gt 0
if ($agentWorkspaceChanged) {
    $findings.Add(
        (New-Finding `
            "low" `
            "agent-control-surface" `
            "Confirm instructions and tools stay procedural, bounded, and privacy-safe.")
    )
}

$suggestedChecks = New-Object System.Collections.Generic.List[string]
$suggestedChecks.Add("git diff --check")
$suggestedChecks.Add(
    "powershell -NoProfile -ExecutionPolicy Bypass -File tools/workspace-check/workspace-check.ps1"
)

$mobilePackagePath = Join-Path $repositoryRoot "mobile-app\package.json"
if ($codeChanged -and (Test-Path -LiteralPath $mobilePackagePath)) {
    $package = Get-Content -LiteralPath $mobilePackagePath -Raw |
        ConvertFrom-Json
    foreach ($scriptName in @("lint", "typecheck", "test")) {
        if ($package.scripts.PSObject.Properties.Name -contains $scriptName) {
            $suggestedChecks.Add(
                "npm --prefix mobile-app run $scriptName"
            )
        }
    }
}

$result = [PSCustomObject]@{
    mode = $reviewMode
    base = $Base
    head = $(if ($Head) { $Head } else { $null })
    generated_at_utc = [DateTime]::UtcNow.ToString("o")
    summary = [PSCustomObject]@{
        changed_files = $files.Count
        findings = $findings.Count
    }
    files = $files
    findings = $findings
    suggested_checks = $suggestedChecks
}

if ($Format -eq "json") {
    $renderedResult = $result | ConvertTo-Json -Depth 6
}
else {
    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add(
        "Diff review: $($files.Count) changed files, $($findings.Count) review notes"
    )
    foreach ($file in $files) {
        $lines.Add(
            "[$($file.status)] $($file.path) ($($file.area), +$($file.additions)/-$($file.deletions))"
        )
    }
    foreach ($finding in $findings) {
        $lines.Add(
            "[$($finding.severity.ToUpperInvariant())] $($finding.code): $($finding.message)"
        )
    }
    $lines.Add("Suggested checks:")
    foreach ($check in $suggestedChecks) {
        $lines.Add("- $check")
    }
    $renderedResult = $lines -join [Environment]::NewLine
}

if ($Out) {
    try {
        $outputPath = Resolve-SafeOutputPath $repositoryRoot $Out
        [System.IO.File]::WriteAllText(
            $outputPath,
            $renderedResult + [Environment]::NewLine
        )
    }
    catch {
        [Console]::Error.WriteLine($_.Exception.Message)
        exit 30
    }
}
else {
    Write-Output $renderedResult
}

exit 0
