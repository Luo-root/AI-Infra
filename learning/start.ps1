$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (-not (Test-Path 'dist/index.html')) {
  throw 'Built site missing. Run npm run build in learning first.'
}
Write-Host 'AI Infra learning reader: http://127.0.0.1:4174'
Write-Host 'Local only. Press Ctrl+C to stop.'
python -m http.server 4174 --bind 127.0.0.1 --directory dist
