$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
New-Item -ItemType Directory -Force -Path '.local' | Out-Null
if (-not (Test-Path 'node_modules')) { npm.cmd install }
Start-Process -FilePath 'npm.cmd' -ArgumentList 'run dev' -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput '.local/server.log' -RedirectStandardError '.local/server-error.log'
Start-Process -FilePath 'node' -ArgumentList 'scripts/publish.mjs --watch' -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput '.local/publish.log' -RedirectStandardError '.local/publish-error.log'
Start-Sleep -Seconds 3
Start-Process 'http://127.0.0.1:8010'
