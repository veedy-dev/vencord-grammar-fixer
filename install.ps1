param(
    [string] $VencordPath = $env:VENCORD_DIR,
    [switch] $SkipBuild,
    [switch] $Help
)

$ErrorActionPreference = "Stop"

function Show-Help {
    "Usage: powershell -ExecutionPolicy Bypass -File .\install.ps1 -VencordPath ""D:\Projects\Vencord"" [-SkipBuild]"
    ""
    "Options:"
    "  -VencordPath   Path to your Vencord checkout. Defaults to VENCORD_DIR when set."
    "  -SkipBuild     Copy files without running corepack pnpm build."
    "  -Help          Show this help."
}

function Resolve-VencordRoot([string] $Path) {
    if ($Path) {
        return (Resolve-Path -LiteralPath $Path).Path
    }

    if ((Test-Path -LiteralPath "package.json") -and (Test-Path -LiteralPath "src")) {
        return (Get-Location).Path
    }

    $enteredPath = Read-Host "Path to your Vencord checkout"
    if (!$enteredPath) {
        throw "Vencord path is required. Pass -VencordPath or set VENCORD_DIR."
    }

    return (Resolve-Path -LiteralPath $enteredPath).Path
}

if ($Help) {
    Show-Help
    exit 0
}

$source = (Resolve-Path -LiteralPath $PSScriptRoot).Path
$vencordRoot = Resolve-VencordRoot $VencordPath
$packageJson = Join-Path $vencordRoot "package.json"
$srcDir = Join-Path $vencordRoot "src"
$userPluginsDir = Join-Path $srcDir "userplugins"
$target = Join-Path $userPluginsDir "grammarFixer"

if (!(Test-Path -LiteralPath $packageJson)) {
    throw "Not a Vencord checkout: missing package.json at $packageJson"
}

if (!(Test-Path -LiteralPath $srcDir)) {
    throw "Not a Vencord checkout: missing src directory at $srcDir"
}

if (!(Test-Path -LiteralPath $userPluginsDir)) {
    New-Item -ItemType Directory -Path $userPluginsDir | Out-Null
}

if (!(Test-Path -LiteralPath $target)) {
    New-Item -ItemType Directory -Path $target | Out-Null
}

$files = @(
    "draft.ts",
    "GrammarFixerModal.tsx",
    "index.tsx",
    "native.ts",
    "prompts.ts",
    "providers.ts",
    "README.md",
    "ReplySuggestionModal.tsx",
    "types.ts",
    "install.ps1",
    "install.sh"
)

$sourcePath = (Resolve-Path -LiteralPath $source).Path.TrimEnd("\")
$targetPath = (Resolve-Path -LiteralPath $target).Path.TrimEnd("\")

if ($sourcePath -ine $targetPath) {
    foreach ($file in $files) {
        $from = Join-Path $source $file
        $to = Join-Path $target $file

        if (!(Test-Path -LiteralPath $from)) {
            throw "Missing plugin file: $from"
        }

        Copy-Item -LiteralPath $from -Destination $to -Force
    }
}

if (!$SkipBuild) {
    Push-Location $vencordRoot
    try {
        corepack pnpm build
    } finally {
        Pop-Location
    }
}

"Installed GrammarFixer to $target"
"Enable GrammarFixer in Vencord settings, then restart Discord or press Ctrl+R."
