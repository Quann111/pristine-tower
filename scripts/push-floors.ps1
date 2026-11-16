$sec = Read-Host 'Mat khau admin PRODUCTION' -AsSecureString
$env:ADMIN_PASS = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
try { node "$PSScriptRoot\push-floors.mjs" } finally { Remove-Item Env:ADMIN_PASS -ErrorAction SilentlyContinue }
