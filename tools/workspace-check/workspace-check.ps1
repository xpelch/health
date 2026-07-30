[CmdletBinding()]
param(
    [string]$RepoRoot,

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

    $gitDirectory = Join-Path $resolvedPath ".git"
    if (-not (Test-Path -LiteralPath $gitDirectory)) {
        throw "Repository root does not contain .git: $resolvedPath"
    }

    return $resolvedPath
}

function Test-PathInsideRepository {
    param(
        [string]$RepositoryRoot,
        [string]$CandidatePath
    )

    $rootWithSeparator = $RepositoryRoot.TrimEnd("\", "/") +
        [System.IO.Path]::DirectorySeparatorChar
    $comparison = [System.StringComparison]::OrdinalIgnoreCase

    return $CandidatePath.StartsWith($rootWithSeparator, $comparison)
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

function New-CheckResult {
    param(
        [string]$Name,
        [bool]$Passed,
        [string]$Detail
    )

    return [PSCustomObject]@{
        name = $Name
        passed = $Passed
        detail = $Detail
    }
}

function Get-ContextIndexPaths {
    param([string]$IndexPath)

    $paths = New-Object System.Collections.Generic.List[string]
    foreach ($line in Get-Content -LiteralPath $IndexPath) {
        if ($line -match "^\s+path:\s+(.+?)\s*$") {
            $path = $Matches[1].Trim().Trim('"').Trim("'")
            $paths.Add($path)
        }
    }

    return $paths
}

function Get-BrokenMarkdownLinks {
    param([string]$RepositoryRoot)

    $brokenLinks = New-Object System.Collections.Generic.List[string]
    $markdownFiles = Get-ChildItem -LiteralPath $RepositoryRoot `
        -Recurse `
        -File `
        -Filter "*.md" |
        Where-Object { $_.FullName -notmatch "[\\/]\.git[\\/]" }

    foreach ($markdownFile in $markdownFiles) {
        $content = Get-Content -LiteralPath $markdownFile.FullName -Raw
        $matches = [regex]::Matches($content, "\[[^\]]+\]\(([^)]+)\)")

        foreach ($match in $matches) {
            $target = $match.Groups[1].Value.Trim().Trim("<", ">")
            if (
                $target.StartsWith("#") -or
                $target -match "^(?i:https?|mailto):"
            ) {
                continue
            }

            $pathWithoutAnchor = $target.Split("#")[0]
            if ([string]::IsNullOrWhiteSpace($pathWithoutAnchor)) {
                continue
            }

            $decodedPath = [System.Uri]::UnescapeDataString($pathWithoutAnchor)
            if ($decodedPath.StartsWith("/")) {
                $resolvedTarget = Join-Path $RepositoryRoot `
                    $decodedPath.TrimStart("/")
            }
            else {
                $resolvedTarget = Join-Path $markdownFile.DirectoryName `
                    $decodedPath
            }

            if (-not (Test-Path -LiteralPath $resolvedTarget)) {
                $relativeFile = $markdownFile.FullName.Substring(
                    $RepositoryRoot.Length + 1
                )
                $brokenLinks.Add("$relativeFile -> $target")
            }
        }
    }

    return $brokenLinks
}

try {
    $repositoryRoot = Resolve-RepositoryRoot $RepoRoot
}
catch {
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 10
}

$checks = New-Object System.Collections.Generic.List[object]
$requiredPaths = @(
    "AGENTS.md",
    "agent-context\IDENTITY.md",
    "context\.meta\index.yaml",
    "playbooks\implement-iteration.md",
    "playbooks\review-change.md",
    "playbooks\recover-from-failure.md",
    "templates\iteration-plan.md",
    "templates\session-summary.md",
    "templates\pr-summary.md",
    "tools\workspace-check\workspace-check.ps1",
    "tools\review-diff\review-diff.ps1",
    "VISION.md",
    "README.md",
    "docs\architecture.md",
    "docs\data-model.md",
    "docs\privacy-and-security.md",
    "docs\product-scope.md",
    "docs\synchronization.md"
)

$missingPaths = @(
    $requiredPaths |
    Where-Object {
        -not (Test-Path -LiteralPath (Join-Path $repositoryRoot $_))
    }
)
$checks.Add(
    (New-CheckResult `
        "required-files" `
        ($missingPaths.Count -eq 0) `
        $(if ($missingPaths.Count -eq 0) {
            "All required files are present."
        }
        else {
            "Missing: " + ($missingPaths -join ", ")
        }))
)

try {
    $unmergedFiles = @(
        & git -C $repositoryRoot ls-files -u 2>&1
    )
    if ($LASTEXITCODE -ne 0) {
        throw ($unmergedFiles -join [Environment]::NewLine)
    }

    $checks.Add(
        (New-CheckResult `
            "unresolved-merges" `
            ($unmergedFiles.Count -eq 0) `
            $(if ($unmergedFiles.Count -eq 0) {
                "No unresolved merge entries."
            }
            else {
                "$($unmergedFiles.Count) unresolved merge entries."
            }))
    )
}
catch {
    [Console]::Error.WriteLine("Git check failed: $($_.Exception.Message)")
    exit 10
}

$contextIndexPath = Join-Path $repositoryRoot "context\.meta\index.yaml"
$indexedPaths = @(Get-ContextIndexPaths $contextIndexPath)
$missingIndexedPaths = @(
    $indexedPaths |
    Where-Object {
        -not (Test-Path -LiteralPath (Join-Path $repositoryRoot $_))
    }
)
$checks.Add(
    (New-CheckResult `
        "context-index" `
        ($missingIndexedPaths.Count -eq 0) `
        $(if ($missingIndexedPaths.Count -eq 0) {
            "$($indexedPaths.Count) indexed paths resolved."
        }
        else {
            "Missing indexed paths: " + ($missingIndexedPaths -join ", ")
        }))
)

$brokenLinks = @(Get-BrokenMarkdownLinks $repositoryRoot)
$checks.Add(
    (New-CheckResult `
        "markdown-links" `
        ($brokenLinks.Count -eq 0) `
        $(if ($brokenLinks.Count -eq 0) {
            "All local Markdown links resolved."
        }
        else {
            "Broken links: " + ($brokenLinks -join "; ")
        }))
)

$failedChecks = @($checks | Where-Object { -not $_.passed })
$result = [PSCustomObject]@{
    status = $(if ($failedChecks.Count -eq 0) { "passed" } else { "failed" })
    repository_root = $repositoryRoot
    checked_at_utc = [DateTime]::UtcNow.ToString("o")
    summary = [PSCustomObject]@{
        passed = $checks.Count - $failedChecks.Count
        failed = $failedChecks.Count
    }
    checks = $checks
}

if ($Format -eq "json") {
    $renderedResult = $result | ConvertTo-Json -Depth 5
}
else {
    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add("Workspace check: $($result.status)")
    foreach ($check in $checks) {
        $marker = $(if ($check.passed) { "PASS" } else { "FAIL" })
        $lines.Add("[$marker] $($check.name): $($check.detail)")
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

if ($failedChecks.Count -gt 0) {
    exit 20
}

exit 0
