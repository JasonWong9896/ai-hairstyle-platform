$ErrorActionPreference = 'Stop'

$target = 'D:\PostgreSQL\18'
$targetRoot = 'D:\PostgreSQL'
$keep = 'D:\ProgramFiles\PostgreSql'
$serviceName = 'postgresql-x64-18'
$targetBin = "$target\bin"
$logPath = 'D:\PostgreSQL-uninstall-moved-18.log'

function Log($message) {
  $line = "$(Get-Date -Format s) $message"
  Add-Content -LiteralPath $logPath -Value $line -Encoding UTF8
  Write-Host $line
}

function Remove-PathEntry($scope) {
  $path = [Environment]::GetEnvironmentVariable('Path', $scope)
  if (-not $path) {
    return
  }

  $parts = $path -split ';' | Where-Object {
    $_ -and
    $_ -ne $targetBin -and
    $_ -ne 'C:\Program Files\PostgreSQL\18\bin'
  }

  [Environment]::SetEnvironmentVariable('Path', ($parts -join ';'), $scope)
}

try {
  $principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Please run this script as Administrator.'
  }

  if ((Resolve-Path -LiteralPath $target -ErrorAction SilentlyContinue).Path -eq (Resolve-Path -LiteralPath $keep -ErrorAction SilentlyContinue).Path) {
    throw "Refusing to uninstall kept PostgreSQL path: $keep"
  }

  Log "Uninstall target: $target"
  Log "Preserving existing install: $keep"

  $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
  if ($service) {
    if ($service.Status -ne 'Stopped') {
      Log "Stopping service $serviceName."
      Stop-Service -Name $serviceName -Force
      (Get-Service -Name $serviceName).WaitForStatus('Stopped', '00:01:00')
    }
  }

  $uninstaller = Join-Path $target 'uninstall-postgresql.exe'
  if (Test-Path -LiteralPath $uninstaller) {
    Log 'Running PostgreSQL uninstaller in unattended mode.'
    $process = Start-Process -FilePath $uninstaller -ArgumentList '--mode', 'unattended' -Wait -PassThru
    Log "Uninstaller exited with code $($process.ExitCode)."
  }

  $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
  if ($service) {
    Log "Deleting leftover service $serviceName."
    & sc.exe delete $serviceName | ForEach-Object { Log $_ }
  }

  if (Test-Path -LiteralPath $target) {
    Log "Removing leftover directory $target."
    Remove-Item -LiteralPath $target -Recurse -Force
  }

  if (Test-Path -LiteralPath $targetRoot) {
    $remaining = Get-ChildItem -LiteralPath $targetRoot -Force -ErrorAction SilentlyContinue
    if (-not $remaining) {
      Log "Removing empty root directory $targetRoot."
      Remove-Item -LiteralPath $targetRoot -Force
    }
  }

  Log 'Removing moved PostgreSQL paths from environment variables.'
  Remove-PathEntry 'Machine'
  Remove-PathEntry 'User'

  Log 'Uninstall completed.'
} catch {
  Log "ERROR: $($_.Exception.Message)"
  throw
}
