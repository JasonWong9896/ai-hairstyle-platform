$ErrorActionPreference = 'Stop'

$oldBin = 'C:\Program Files\PostgreSQL\18\bin'
$newBin = 'D:\PostgreSQL\18\bin'
$envPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Environment'

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw 'Please run this script as Administrator.'
}

$path = (Get-ItemProperty -Path $envPath -Name Path).Path
$parts = $path -split ';' | Where-Object { $_ -and $_ -ne $oldBin }
if ($parts -notcontains $newBin) {
  $parts += $newBin
}

Set-ItemProperty -Path $envPath -Name Path -Value ($parts -join ';')
Write-Host "Updated machine PATH for PostgreSQL: $newBin"
