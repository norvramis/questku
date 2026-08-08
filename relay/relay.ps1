# Questku Relay — localhost HTTP relay for the ACHIEVEMENT_IN_ACTIVITY bypass.
#
# Discord's renderer CSP allows connect-src to http://127.0.0.1:* but blocks
# *.discordsays.com directly. This script listens on 127.0.0.1:43210 and forwards
# POSTs from questku.js to the activity backend, bypassing CSP.
#
# Raw TcpListener (NOT HttpListener): HttpListener/Http.sys silently drops the
# `Access-Control-Allow-Private-Network` header that Chrome's Private Network
# Access requires for a public page to fetch a loopback address. A manually
# wrapped HTTP/1.1 reply can emit any header.
#
# Run by double-clicking start-relay.cmd. Keep the window open. Ctrl+C to stop.

$ErrorActionPreference = 'Continue'
$port = 43210
$allowedHost = '^[0-9]+\.discordsays\.com$'
$allowedPaths = @('/.proxy/acf/authorize', '/.proxy/acf/quest/progress')
$allowedOrigins = @('https://discord.com', 'https://canary.discord.com', 'https://ptb.discord.com')

# Rate limiting
$maxConcurrent = 10
$maxRequestsPerMinute = 100
$requestCounts = @{}
$activeConnections = 0

$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $port)
try {
    $listener.Start()
} catch {
    Write-Host "[Questku Relay] Failed to bind $port : $($_.Exception.Message)" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Questku Relay listening on 127.0.0.1:$port" -ForegroundColor Cyan
Write-Host " Paste questku.js in Discord DevTools." -ForegroundColor Cyan
Write-Host " Keep this window open. Ctrl+C to stop." -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

function Respond-Raw {
    param($stream, [int]$status, [string]$reason, [string]$ct, [string]$body, [string]$aca)
    $bb = [System.Text.Encoding]::UTF8.GetBytes($body)
    $head = "HTTP/1.1 $status $reason`r`n"
    if ($aca) { $head += "Access-Control-Allow-Origin: $aca`r`n" }
    $head += "Access-Control-Allow-Private-Network: true`r`n"
    $head += "Access-Control-Allow-Headers: Content-Type`r`n"
    $head += "Access-Control-Allow-Methods: GET, POST, OPTIONS`r`n"
    $head += "Cache-Control: no-store`r`n"
    $head += "Content-Type: $ct`r`n"
    $head += "Content-Length: $($bb.Length)`r`n`r`n"
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($head)
    $stream.Write($bytes, 0, $bytes.Length)
    if ($bb.Length -gt 0) { $stream.Write($bb, 0, $bb.Length) }
    $stream.Flush()
}

function Cleanup-RequestCounts {
    $now = [DateTime]::UtcNow
    $keysToRemove = $requestCounts.Keys | Where-Object { $now - $requestCounts[$_].time -gt (New-TimeSpan -Minutes 1) }
    foreach ($k in $keysToRemove) { $requestCounts.Remove($k) }
}

function Check-RateLimit($origin) {
    Cleanup-RequestCounts
    $now = [DateTime]::UtcNow
    if (-not $requestCounts.ContainsKey($origin)) {
        $requestCounts[$origin] = @{ count = 0; time = $now }
    }
    $requestCounts[$origin].count++
    return $requestCounts[$origin].count -le $maxRequestsPerMinute
}

function Validate-Url($urlStr) {
    try {
        $uri = [System.Uri]::new($urlStr)
        if ($uri.Scheme -ne 'https') { return $false }
        if ($uri.Host -notmatch $allowedHost) { return $false }
        $pathOk = $false
        foreach ($p in $allowedPaths) {
            if ($uri.AbsolutePath -eq $p) { $pathOk = $true; break }
        }
        if (-not $pathOk) { return $false }
        return $true
    } catch {
        return $false
    }
}

function Get-AllowedOrigin($origin) {
    if (-not $origin) { return $null }
    if ($allowedOrigins -contains $origin) { return $origin }
    if ($origin -match '^chrome-extension://[a-z]{32}$') { return $origin }
    return $null
}

while ($true) {
    $client = $null
    try { $client = $listener.AcceptTcpClient() } catch { break }

    # Connection limit
    $activeConnections++
    if ($activeConnections -gt $maxConcurrent) {
        $activeConnections--
        try { $client.Close() } catch {}
        continue
    }

    $stream = $client.GetStream()
    $reader = New-Object System.IO.BinaryReader($stream)

    try {
        # Read headers (raw bytes up to CRLFCRLF) so StreamReader can't steal body bytes.
        $headBytes = New-Object System.Collections.Generic.List[byte]
        $ok = $false
        while ($headBytes.Count -lt 65536) {
            $b = $stream.ReadByte()
            if ($b -lt 0) { break }
            $headBytes.Add([byte]$b)
            if ($headBytes.Count -ge 4) {
                if ($headBytes[$headBytes.Count-4] -eq 13 -and $headBytes[$headBytes.Count-3] -eq 10 -and $headBytes[$headBytes.Count-2] -eq 13 -and $headBytes[$headBytes.Count-1] -eq 10) { $ok = $true; break }
            }
        }
        if (-not $ok) { continue }
        $headStr = [System.Text.Encoding]::UTF8.GetString($headBytes.ToArray())
        $lines = $headStr -split "`r`n"
        $reqX = ($lines[0] -split ' '); if ($reqX.Count -lt 2) { continue }
        $method = $reqX[0]; $path = $reqX[1]
        Write-Host "[$(Get-Date -Format HH:mm:ss)] $method $path"

        $clen = 0; $hostHeader = $null; $origin = $null
        foreach ($l in $lines[1..($lines.Count-1)]) {
            if ($l -match '^([^:]+):\s*(.*)$') {
                $k = $matches[1].ToLowerInvariant(); $v = $matches[2]
                if ($k -eq 'content-length') { $clen = [int]$v }
                elseif ($k -eq 'host') { $hostHeader = $v }
                elseif ($k -eq 'origin') { $origin = $v }
            }
        }

        # Host guard (DNS-rebinding).
        if ($hostHeader -and $hostHeader -ne "127.0.0.1:$port") { Respond-Raw $stream 403 'Forbidden' 'application/json' '{"ok":false,"status":0,"body":"bad host"}' $null; continue }

        # CORS origin validation - whitelist only
        $aca = Get-AllowedOrigin $origin

        # Rate limit per origin
        if ($aca -and -not (Check-RateLimit $aca)) {
            Respond-Raw $stream 429 'Too Many Requests' 'application/json' '{"ok":false,"status":429,"body":"rate limit exceeded"}' $aca
            continue
        }

        if ($method -eq 'OPTIONS') { Respond-Raw $stream 204 'No Content' '' '' $aca; continue }
        if ($method -eq 'GET' -and $path -eq '/health') { Respond-Raw $stream 200 'OK' 'application/json' '{"ok":true,"name":"questku-relay","version":"1"}' $aca; continue }

        if ($method -eq 'POST' -and $path -eq '/proxy') {
            if ($clen -gt 65536) { Respond-Raw $stream 413 'Payload Too Large' 'application/json' '{"ok":false,"status":0,"body":"payload too large"}' $aca; continue }
            $bodyBytes = New-Object byte[] $clen
            $read = 0
            while ($read -lt $clen) { $n = $stream.Read($bodyBytes, $read, $clen - $read); if ($n -le 0) { break }; $read += $n }
            $raw = [System.Text.Encoding]::UTF8.GetString($bodyBytes)
            $raw = $raw.TrimStart([char]0xFEFF, [char]0xFE, [char]0xFF, [char]0xEF, [char]0xBB, [char]0xBF)
            $payload = $raw | ConvertFrom-Json

            # SSRF fix: validate URL before any network call
            if (-not (Validate-Url $payload.url)) {
                Respond-Raw $stream 403 'Forbidden' 'application/json' '{"ok":false,"status":0,"body":"invalid upstream url"}' $aca
                continue
            }

            $upstreamUri = [System.Uri]::new("$($payload.url)")
            $up = [System.Net.HttpWebRequest]::Create($upstreamUri)
            $up.Method = 'POST'; $up.ContentType = 'application/json'; $up.UserAgent = 'QuestkuRelay/1.0'
            $up.AllowAutoRedirect = $false; $up.Timeout = 20000
            foreach ($pr in $payload.headers.PSObject.Properties) {
                $nm = $pr.Name.ToLowerInvariant(); $val = [string]$pr.Value
                switch ($nm) {
                    'content-type'  { $up.ContentType = $val }
                    'user-agent'    { $up.UserAgent = $val }
                    'referer'       { $up.Referer = $val }
                    'accept'        { $up.Accept = $val }
                    'x-auth-token'       { $up.Headers['X-Auth-Token'] = $val }
                    'x-discord-quest-id' { $up.Headers['X-Discord-Quest-ID'] = $val }
                    default { }
                }
            }
            $bodyJson = $payload.body | ConvertTo-Json -Compress -Depth 10
            $reqBytes = [System.Text.Encoding]::UTF8.GetBytes("$bodyJson")
            $up.ContentLength = $reqBytes.Length
            $rs = $up.GetRequestStream(); $rs.Write($reqBytes, 0, $reqBytes.Length); $rs.Close()

            $statusCode = 0; $resBody = ''
            try {
                $upRes = $up.GetResponse()
                $statusCode = [int]$upRes.StatusCode
                $rr = New-Object System.IO.StreamReader($upRes.GetResponseStream()); $resBody = $rr.ReadToEnd(); $rr.Dispose(); $upRes.Close()
            } catch [System.Net.WebException] {
                $upRes = $_.Exception.Response
                if ($upRes) {
                    $statusCode = [int]$upRes.StatusCode
                    $rr = New-Object System.IO.StreamReader($upRes.GetResponseStream()); $resBody = $rr.ReadToEnd(); $rr.Dispose(); $upRes.Close()
                } else {
                    $resBody = $_.Exception.Message
                }
            }
            $ok = $statusCode -ge 200 -and $statusCode -lt 300
            $resJson = (@{ ok = $ok; status = $statusCode; body = $resBody } | ConvertTo-Json -Compress)
            $upHost = $upstreamUri.Host
            Write-Host "[$(Get-Date -Format HH:mm:ss)] POST $($upstreamUri.PathAndQuery) -> $statusCode ($upHost)"
            Respond-Raw $stream 200 'OK' 'application/json' $resJson $aca
            continue
        }

        Respond-Raw $stream 404 'Not Found' 'application/json' '{"ok":false,"status":404,"body":"unknown endpoint"}' $aca
    } catch {
        $em = $_.Exception.Message -replace '"', "'"
        Write-Host "[$(Get-Date -Format HH:mm:ss)] relay error: $em" -ForegroundColor Red
        try { Respond-Raw $stream 500 'Error' 'application/json' "{`"ok`":false,`"status`":0,`"body`":`"relay error: $em`"}" $aca } catch {}
    } finally {
        $activeConnections--
        try { $client.Close() } catch {}
    }
}
$listener.Stop()