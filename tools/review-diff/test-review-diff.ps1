[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptPath = Join-Path $PSScriptRoot "review-diff.ps1"
$temporaryRoot = Join-Path ([System.IO.Path]::GetTempPath()) `
    ("health-review-diff-" + [Guid]::NewGuid().ToString("N"))
$fixtureRoot = Join-Path $temporaryRoot "fixture"
$outsideOutput = Join-Path $temporaryRoot "outside.json"

function Invoke-ReviewDiff {
    param(
        [string[]]$Arguments,
        [ref]$Output
    )

    $previousErrorAction = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        $Output.Value = & powershell.exe `
            -NoProfile `
            -ExecutionPolicy Bypass `
            -File $scriptPath `
            @Arguments 2>&1
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorAction
    }

    return $exitCode
}

try {
    New-Item -ItemType Directory -Path $fixtureRoot | Out-Null
    & git -C $fixtureRoot init --quiet
    & git -C $fixtureRoot config user.email "fixture@example.invalid"
    & git -C $fixtureRoot config user.name "Health Tool Test"

    Set-Content -LiteralPath (Join-Path $fixtureRoot "README.md") `
        -Value "# Fixture"
    & git -C $fixtureRoot add README.md
    & git -C $fixtureRoot commit --quiet -m "initial"

    Add-Content -LiteralPath (Join-Path $fixtureRoot "README.md") `
        -Value "Updated."
    & git -C $fixtureRoot add README.md
    & git -C $fixtureRoot commit --quiet -m "update"

    $jsonOutput = $null
    $validExitCode = Invoke-ReviewDiff `
        @(
            "-RepoRoot",
            $fixtureRoot,
            "-Base",
            "HEAD~1",
            "-Head",
            "HEAD",
            "-Format",
            "json"
        ) `
        ([ref]$jsonOutput)

    if ($validExitCode -ne 0) {
        throw "Expected exit code 0, received $validExitCode."
    }

    $report = ($jsonOutput -join [Environment]::NewLine) |
        ConvertFrom-Json
    if ($report.summary.changed_files -ne 1) {
        throw "Expected one changed file."
    }

    $invalidOutput = $null
    $invalidRevisionExitCode = Invoke-ReviewDiff `
        @(
            "-RepoRoot",
            $fixtureRoot,
            "-Base",
            "missing-revision",
            "-Head",
            "HEAD"
        ) `
        ([ref]$invalidOutput)
    if ($invalidRevisionExitCode -ne 10) {
        throw "Expected exit code 10, received $invalidRevisionExitCode."
    }

    $unsafeOutput = $null
    $unsafeOutputExitCode = Invoke-ReviewDiff `
        @(
            "-RepoRoot",
            $fixtureRoot,
            "-Out",
            $outsideOutput
        ) `
        ([ref]$unsafeOutput)
    if ($unsafeOutputExitCode -ne 30) {
        throw "Expected exit code 30, received $unsafeOutputExitCode."
    }

    Write-Output "review-diff self-test passed"
}
finally {
    if (Test-Path -LiteralPath $temporaryRoot) {
        Remove-Item -LiteralPath $temporaryRoot -Recurse -Force
    }
}
