$path = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer\Advanced"
if (!(Test-Path $path)) { New-Item -Path $path -Force | Out-Null }
Set-ItemProperty -Path $path -Name "EnableDevTools" -Value 1 -Type DWord -Force
Write-Host "[OK] DevTools enabled. Restart Discord."
pause
