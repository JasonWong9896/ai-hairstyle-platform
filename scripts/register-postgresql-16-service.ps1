$ErrorActionPreference = 'Stop'

$pgRoot = 'D:\ProgramFiles\PostgreSql'
$pgData = Join-Path $pgRoot 'data'
$pgCtl = Join-Path $pgRoot 'bin\pg_ctl.exe'
$serviceName = 'postgresql-x64-16'
$serviceAccount = 'NT AUTHORITY\NetworkService'
$logPath = 'D:\ProgramFiles\PostgreSql\register-service.log'

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

  if (-not (Test-Path -LiteralPath $pgCtl)) {
    throw "Missing pg_ctl.exe: $pgCtl"
  }
  if (-not (Test-Path -LiteralPath $pgData)) {
    throw "Missing data directory: $pgData"
  }

  $existing = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
  if ($existing) {
    Log "Service $serviceName already exists."
  } else {
    Log "Registering service $serviceName."
    & $pgCtl register -N $serviceName -D $pgData -U $serviceAccount -S auto | ForEach-Object { Log $_ }
  }

  Log "Starting service $serviceName."
  Start-Service -Name $serviceName
  (Get-Service -Name $serviceName).WaitForStatus('Running', '00:01:00')
  Log "Service $serviceName is running."

  & (Join-Path $pgRoot 'bin\psql.exe') --version | ForEach-Object { Log $_ }
} catch {
  Log "ERROR: $($_.Exception.Message)"
  throw
}
