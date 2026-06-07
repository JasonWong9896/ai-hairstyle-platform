$ErrorActionPreference = 'Stop'

$old = 'C:\Program Files\PostgreSQL\18'
$new = 'D:\PostgreSQL\18'
$serviceName = 'postgresql-x64-18'
$backupPath = 'D:\PostgreSQL\migration-backup-service-path.txt'
$copyLog = 'D:\PostgreSQL\migration-robocopy.log'
$excludedPgAdmin = Join-Path $old 'pgAdmin 4'

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw 'Please run this script as Administrator.'
}

if (-not (Test-Path -LiteralPath $old)) {
  throw "Source path does not exist: $old"
}

$service = Get-Service -Name $serviceName -ErrorAction Stop
if ($service.Status -ne 'Stopped') {
  Stop-Service -Name $serviceName -Force
  $service.WaitForStatus('Stopped', '00:01:00')
}

New-Item -ItemType Directory -Force -Path (Split-Path $new) | Out-Null
Remove-Item -LiteralPath (Join-Path $new 'pgAdmin 4') -Recurse -Force -ErrorAction SilentlyContinue

robocopy $old $new /MIR /ZB /COPY:DAT /DCOPY:DAT /R:2 /W:2 /XD $excludedPgAdmin /LOG:$copyLog /TEE
if ($LASTEXITCODE -ge 8) {
  throw "robocopy failed with exit code $LASTEXITCODE. See $copyLog"
}

$serviceKey = "HKLM:\SYSTEM\CurrentControlSet\Services\$serviceName"
$oldImagePath = (Get-ItemProperty $serviceKey).ImagePath
Set-Content -LiteralPath $backupPath -Value $oldImagePath -Encoding UTF8

$newImagePath = "`"$new\bin\pg_ctl.exe`" runservice -N `"$serviceName`" -D `"$new\data`" -w"
Set-ItemProperty -Path $serviceKey -Name ImagePath -Value $newImagePath

$machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
$newBin = "$new\bin"
$oldBin = "$old\bin"
$pathParts = $machinePath -split ';' | Where-Object { $_ -and $_ -ne $oldBin }
if ($pathParts -notcontains $newBin) {
  $pathParts += $newBin
}
[Environment]::SetEnvironmentVariable('Path', ($pathParts -join ';'), 'Machine')

Start-Service -Name $serviceName
(Get-Service -Name $serviceName).WaitForStatus('Running', '00:01:00')

& "$new\bin\psql.exe" --version

Remove-Item -LiteralPath $old -Recurse -Force

Write-Host "PostgreSQL moved to $new"
Write-Host "Old service ImagePath saved to $backupPath"
