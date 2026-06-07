$ErrorActionPreference = 'Stop'

$serviceName = 'postgresql-x64-18'
$service = Get-Service -Name $serviceName -ErrorAction Stop
if ($service.Status -ne 'Running') {
  Start-Service -Name $serviceName
  (Get-Service -Name $serviceName).WaitForStatus('Running', '00:01:00')
}

Get-Service -Name $serviceName
