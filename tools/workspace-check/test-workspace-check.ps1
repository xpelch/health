[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptPath = Join-Path $PSScriptRoot "workspace-check.ps1"
$temporaryRoot = Join-Path ([System.IO.Path]::GetTempPath()) `
    ("health-workspace-check-" + [Guid]::NewGuid().ToString("N"))
$fixtureRoot = Join-Path $temporaryRoot "fixture"
$outsideOutput = Join-Path $temporaryRoot "outside.json"

function Invoke-WorkspaceCheck {
    param([string[]]$Arguments)

    $previousErrorAction = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        & powershell.exe `
            -NoProfile `
            -ExecutionPolicy Bypass `
            -File $scriptPath `
            @Arguments 2>&1 | Out-Null
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
    if ($LASTEXITCODE -ne 0) {
        throw "Could not initialize the fixture repository."
    }

    $requiredFiles = @(
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

    foreach ($relativePath in $requiredFiles) {
        $filePath = Join-Path $fixtureRoot $relativePath
        $parentPath = Split-Path -Parent $filePath
        New-Item -ItemType Directory -Path $parentPath -Force | Out-Null

        if ($relativePath -eq "context\.meta\index.yaml") {
            Set-Content -LiteralPath $filePath `
                -Value "schema_version: 1`nentries:`n  - path: VISION.md"
        }
        else {
            Set-Content -LiteralPath $filePath -Value "# Fixture"
        }
    }

    $healthyExitCode = Invoke-WorkspaceCheck @(
        "-RepoRoot",
        $fixtureRoot,
        "-Format",
        "json"
    )
    if ($healthyExitCode -ne 0) {
        throw "Expected a healthy fixture, received exit code $healthyExitCode."
    }

    Remove-Item -LiteralPath (Join-Path $fixtureRoot "VISION.md")
    $missingFileExitCode = Invoke-WorkspaceCheck @(
        "-RepoRoot",
        $fixtureRoot
    )
    if ($missingFileExitCode -ne 20) {
        throw "Expected exit code 20, received $missingFileExitCode."
    }

    Set-Content -LiteralPath (Join-Path $fixtureRoot "VISION.md") `
        -Value "# Fixture"
    $unsafeOutputExitCode = Invoke-WorkspaceCheck @(
        "-RepoRoot",
        $fixtureRoot,
        "-Out",
        $outsideOutput
    )
    if ($unsafeOutputExitCode -ne 30) {
        throw "Expected exit code 30, received $unsafeOutputExitCode."
    }

    Write-Output "workspace-check self-test passed"
}
finally {
    if (Test-Path -LiteralPath $temporaryRoot) {
        Remove-Item -LiteralPath $temporaryRoot -Recurse -Force
    }
}
