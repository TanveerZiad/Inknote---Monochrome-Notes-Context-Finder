$ErrorActionPreference = 'Stop'

Write-Host "==> Installing Inknote for Windows..." -ForegroundColor Cyan

# Resolve latest release tag via web redirect (bypasses GitHub API rate limits)
$repo = "TanveerZiad/Inknote---Monochrome-Notes-Context-Finder"
$webUrl = "https://github.com/$repo/releases/latest"

try {
    $request = [System.Net.WebRequest]::Create($webUrl)
    $request.AllowAutoRedirect = $false
    $response = $request.GetResponse()
    $location = $response.Headers["Location"]
    $tagName = Split-Path $location -Leaf
    if (-not $tagName) {
        throw "Could not parse release tag from redirect."
    }
} catch {
    Write-Host "Failed to resolve latest release tag." -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

Write-Host "Found latest version: $tagName" -ForegroundColor Green

$versionNum = $tagName.TrimStart('v')
$fileName = "Inknote_${versionNum}_x64-setup.exe"
$downloadUrl = "https://github.com/$repo/releases/download/$tagName/$fileName"
$tempPath = Join-Path $env:TEMP $fileName

Write-Host "Downloading $fileName..." -ForegroundColor Cyan
try {
    Invoke-WebRequest -Uri $downloadUrl -OutFile $tempPath
} catch {
    $fileName = "Inknote_${versionNum}_x64_en-US.msi"
    $downloadUrl = "https://github.com/$repo/releases/download/$tagName/$fileName"
    $tempPath = Join-Path $env:TEMP $fileName
    Invoke-WebRequest -Uri $downloadUrl -OutFile $tempPath
}

Write-Host "Launching installer..." -ForegroundColor Green
Start-Process -FilePath $tempPath -Wait

Write-Host "Successfully completed installation for Inknote $tagName!" -ForegroundColor Green
