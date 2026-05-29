param(
    [string]$IdentityName = "net.aariy.prime-video-tauri",
    [string]$Publisher = "CN=AariyJP",
    [string]$PublisherDisplayName = "AariyJP",
    [string]$DisplayName = "Prime Video Tauri",
    [string]$Architecture = "x64",
    [string]$Version = "",
    [bool]$CreateUpload = $true,
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

function ConvertTo-PackageVersion {
    param([string]$InputVersion)

    $parts = @($InputVersion.Split(".") | ForEach-Object { [int]$_ })
    while ($parts.Count -lt 4) {
        $parts += 0
    }

    ($parts[0..3] -join ".")
}

function Find-WindowsSdkTool {
    param([string]$ToolName)

    $kitsRoot = Join-Path ${env:ProgramFiles(x86)} "Windows Kits\10\bin"
    $candidate = Get-ChildItem -Path $kitsRoot -Recurse -Filter $ToolName -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -match "\\x64\\$([regex]::Escape($ToolName))$" } |
        Sort-Object FullName -Descending |
        Select-Object -First 1

    if (-not $candidate) {
        throw "$ToolName was not found in the Windows SDK."
    }

    $candidate.FullName
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$tauriConfigPath = Join-Path $repoRoot "src-tauri\tauri.conf.json"
$tauriConfig = Get-Content -Raw $tauriConfigPath | ConvertFrom-Json

if ([string]::IsNullOrWhiteSpace($Version)) {
    $Version = ConvertTo-PackageVersion $tauriConfig.version
} else {
    $Version = ConvertTo-PackageVersion $Version
}

if (-not $SkipBuild) {
    Push-Location $repoRoot
    try {
        pnpm build
    } finally {
        Pop-Location
    }
}

$releaseDir = Join-Path $repoRoot "src-tauri\target\release"
$exePath = Join-Path $releaseDir "prime-video-tauri.exe"

if (-not (Test-Path $exePath)) {
    throw "Release executable was not found: $exePath"
}

$outputDir = Join-Path $repoRoot "src-tauri\target\msix"
$packageRoot = Join-Path $outputDir "PackageRoot"
$assetsDir = Join-Path $packageRoot "Assets"
$uploadDir = Join-Path $outputDir "Upload"
$safeName = $DisplayName -replace "[^A-Za-z0-9]+", ""
$packageName = "${safeName}_${Version}_${Architecture}"
$msixPath = Join-Path $outputDir "$packageName.msix"
$msixUploadPath = Join-Path $outputDir "$packageName.msixupload"
$appxSymPath = Join-Path $outputDir "$packageName.appxsym"

Remove-Item -Recurse -Force $packageRoot, $uploadDir -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $packageRoot, $assetsDir, $uploadDir | Out-Null

Copy-Item $exePath $packageRoot

foreach ($resourceName in @("adg", "ext")) {
    $resourcePath = Join-Path $releaseDir $resourceName
    if (-not (Test-Path $resourcePath)) {
        throw "Runtime resource was not found: $resourcePath"
    }

    Copy-Item $resourcePath $packageRoot -Recurse
}

$iconDir = Join-Path $repoRoot "src-tauri\icons"
foreach ($assetName in @("StoreLogo.png", "Square44x44Logo.png", "Square71x71Logo.png", "Square150x150Logo.png")) {
    $assetPath = Join-Path $iconDir $assetName
    if (-not (Test-Path $assetPath)) {
        throw "MSIX asset was not found: $assetPath"
    }

    Copy-Item $assetPath $assetsDir
}

$manifestPath = Join-Path $packageRoot "AppxManifest.xml"
$manifest = @"
<?xml version="1.0" encoding="utf-8"?>
<Package xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10" xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10" xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities" IgnorableNamespaces="uap rescap">
  <Identity Name="$IdentityName" Publisher="$Publisher" Version="$Version" ProcessorArchitecture="$Architecture" />
  <Properties>
    <DisplayName>$DisplayName</DisplayName>
    <PublisherDisplayName>$PublisherDisplayName</PublisherDisplayName>
    <Logo>Assets\StoreLogo.png</Logo>
  </Properties>
  <Dependencies>
    <TargetDeviceFamily Name="Windows.Desktop" MinVersion="10.0.17763.0" MaxVersionTested="10.0.26100.0" />
  </Dependencies>
  <Resources>
    <Resource Language="en-US" />
  </Resources>
  <Applications>
    <Application Id="PrimeVideoTauri" Executable="prime-video-tauri.exe" EntryPoint="windows.fullTrustApplication">
      <uap:VisualElements DisplayName="$DisplayName" Description="$DisplayName" Square150x150Logo="Assets\Square150x150Logo.png" Square44x44Logo="Assets\Square44x44Logo.png" BackgroundColor="#2D2D2D">
        <uap:DefaultTile Square71x71Logo="Assets\Square71x71Logo.png" />
      </uap:VisualElements>
    </Application>
  </Applications>
  <Capabilities>
    <rescap:Capability Name="runFullTrust" />
  </Capabilities>
</Package>
"@

Set-Content -Path $manifestPath -Value $manifest -Encoding utf8

$makeAppx = Find-WindowsSdkTool "makeappx.exe"
& $makeAppx pack /v /h SHA256 /d $packageRoot /p $msixPath /o

if ($LASTEXITCODE -ne 0) {
    throw "MSIX package creation failed with exit code $LASTEXITCODE."
}

$pdbPath = Join-Path $releaseDir "prime_video_tauri.pdb"
if (Test-Path $pdbPath) {
    $symbolsDir = Join-Path $outputDir "Symbols"
    $symbolsZipPath = Join-Path $outputDir "$packageName.zip"
    Remove-Item -Recurse -Force $symbolsDir -ErrorAction SilentlyContinue
    Remove-Item -Force $symbolsZipPath, $appxSymPath -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Force $symbolsDir | Out-Null
    Copy-Item $pdbPath $symbolsDir
    Compress-Archive -Path (Join-Path $symbolsDir "*") -DestinationPath $symbolsZipPath -Force
    Move-Item $symbolsZipPath $appxSymPath -Force
}

if ($CreateUpload) {
    Remove-Item -Force $msixUploadPath -ErrorAction SilentlyContinue
    Copy-Item $msixPath $uploadDir
    if (Test-Path $appxSymPath) {
        Copy-Item $appxSymPath $uploadDir
    }

    $uploadZipPath = Join-Path $outputDir "$packageName.upload.zip"
    Remove-Item -Force $uploadZipPath -ErrorAction SilentlyContinue
    Compress-Archive -Path (Join-Path $uploadDir "*") -DestinationPath $uploadZipPath -Force
    Move-Item $uploadZipPath $msixUploadPath -Force
}

[pscustomobject]@{
    Msix = $msixPath
    MsixUpload = if ($CreateUpload) { $msixUploadPath } else { $null }
    AppxSym = if (Test-Path $appxSymPath) { $appxSymPath } else { $null }
    PackageRoot = $packageRoot
    IdentityName = $IdentityName
    Publisher = $Publisher
    Version = $Version
}
