param(
  [int]$Count = 30,
  [string]$Output = ".\downloads"
)

$ErrorActionPreference = "Stop"
$env:PYTHONUTF8 = "1"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

python "$ScriptDir\hairstyle_crawler.py" --count $Count --output $Output
