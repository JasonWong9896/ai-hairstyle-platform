$ErrorActionPreference = 'Stop'

$old = 'C:\Program Files\PostgreSQL\18'
$new = 'D:\PostgreSQL\18'
$serviceName = 'postgresql-x64-18'
$logPath = 'D:\PostgreSQL\migration-finalize.log'

function Log($message) {
  $line = "$(Get-Date -Format s) $message"
  Add-Content -LiteralPath $logPath -Value $line -Encoding UTF8
  Write-Host $line
}

try {
  $principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Please run this script as Administrator.'
  }

  Log 'Starting finalize step.'

  if (-not (Test-Path -LiteralPath "$new\bin\pg_ctl.exe")) {
    throw "Missing pg_ctl.exe in $new"
  }
  if (-not (Test-Path -LiteralPath "$new\data")) {
    throw "Missing data directory in $new"
  }

  $service = Get-Service -Name $serviceName -ErrorAction Stop
  if ($service.Status -ne 'Stopped') {
    Log 'Stopping PostgreSQL service.'
    Stop-Service -Name $serviceName -Force
    (Get-Service -Name $serviceName).WaitForStatus('Stopped', '00:01:00')
  }

  $binPath = "`"$new\bin\pg_ctl.exe`" runservice -N `"$serviceName`" -D `"$new\data`" -w"
  Log "Setting service binPath to: $binPath"
  & sc.exe config $serviceName binPath= $binPath | ForEach-Object { Log $_ }

  $machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $oldBin = "$old\bin"
  $newBin = "$new\bin"
  $pathParts = $machinePath -split ';' | Where-Object { $_ -and $_ -ne $oldBin }
  if ($pathParts -notcontains $newBin) {
    $pathParts += $newBin
  }
  [Environment]::SetEnvironmentVariable('Path', ($pathParts -join ';'), 'Machine')
  Log 'Updated machine PATH.'

  Log 'Starting PostgreSQL service.'
  Start-Service -Name $serviceName
  (Get-Service -Name $serviceName).WaitForStatus('Running', '00:01:00')
  Log 'PostgreSQL service is running.'

  & "$new\bin\psql.exe" --version | ForEach-Object { Log $_ }

  if (Test-Path -LiteralPath $old) {
    Log "Deleting old directory: $old"
    Remove-Item -LiteralPath $old -Recurse -Force
  }

  Log 'Finalize step completed.'
} catch {
  Log "ERROR: $($_.Exception.Message)"
  throw
}
