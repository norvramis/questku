# Questku — enable Chrome access to the local relay (127.0.0.1:43210).
#
# Chrome (since the PNA flag was removed) blocks a public site from fetching a
# loopback address by default. This writes the Chrome Machine policy that allows
# it, so the web extension can reach the relay for Achievement quests.
#
# Run ONCE per machine as Administrator, then restart Chrome.
#
#   right-click > Run as Administrator (or):
#   powershell -ExecutionPolicy Bypass -File enable-pna.ps1
#
# Fully reversible:
#   Remove-ItemProperty -Path 'HKLM:\SOFTWARE\Policies\Google\Chrome' -Name 'LocalNetworkAccessAllowedForUrls'
#   Remove-ItemProperty -Path 'HKLM:\SOFTWARE\Policies\Google\Chrome' -Name 'InsecurePrivateNetworkRequestsAllowedForUrls'

$ErrorActionPreference = 'Stop'

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host 'Run this as Administrator (right-click > Run as Administrator).' -ForegroundColor Red
    Read-Host 'Press Enter to exit'
    exit 1
}

$key = 'HKLM:\SOFTWARE\Policies\Google\Chrome'
if (-not (Test-Path $key)) { New-Item -Path $key -Force | Out-Null }

# URL-list policies are stored as a JSON array in a REG_SZ. This policy is ORIGIN-based:
# the sites (Discord origins) that are allowed to reach the local relay. The loopback
# target stays in the list too so it works either way the build interprets it.
$val = '["https://discord.com","https://*.discord.com","http://127.0.0.1:43210"]'
Set-ItemProperty -Path $key -Name 'LocalNetworkAccessAllowedForUrls' -Value $val -Type String

# Edge is Chromium too, same policy, different registry path.
$edge = 'HKLM:\SOFTWARE\Policies\Microsoft\Edge'
if (-not (Test-Path $edge)) { New-Item -Path $edge -Force | Out-Null }
Set-ItemProperty -Path $edge -Name 'LocalNetworkAccessAllowedForUrls' -Value $val -Type String

# Drop the obsolete key if a previous run set it (Chrome only; Edge never had it).
Remove-ItemProperty -Path $key -Name 'InsecurePrivateNetworkRequestsAllowedForUrls' -ErrorAction SilentlyContinue

Write-Host 'Chrome policy written - allows Questku relay (127.0.0.1:43210).' -ForegroundColor Green
Write-Host 'Restart Chrome, then: run relay\start-relay.cmd, open Discord web, enable the Questku extension.'
Read-Host 'Press Enter to exit'