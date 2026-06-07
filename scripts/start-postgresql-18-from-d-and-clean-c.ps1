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

  $imagePath = (Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Services\$serviceName").ImagePath
  Log "Current ImagePath: $imagePath"
  if ($imagePath -notlike "*$new*") {
    throw "Service does not point to $new"
  }

  Log 'Starting PostgreSQL service.'
  Start-Service -Name $serviceName
  (Get-Service -Name $serviceName).WaitForStatus('Running', '00:01:00')
  Log 'PostgreSQL service is running from D drive.'

  & "$new\bin\psql.exe" --version | ForEach-Object { Log $_ }

  if (Test-Path -LiteralPath $old) {
    Log "Deleting old directory: $old"
    Remove-Item -LiteralPath $old -Recurse -Force
  }

  Log 'D drive migration cleanup completed.'
} catch {
  Log "ERROR: $($_.Exception.Message)"
  throw
}
