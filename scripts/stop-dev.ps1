[CmdletBinding(SupportsShouldProcess = $true)]
param()

$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$processes = @(Get-CimInstance Win32_Process)
$coordinators = @($processes | Where-Object {
  $_.CommandLine -and
  $_.CommandLine.IndexOf($projectRoot, [StringComparison]::OrdinalIgnoreCase) -ge 0 -and
  $_.CommandLine.IndexOf('concurrently', [StringComparison]::OrdinalIgnoreCase) -ge 0
})

if (-not $coordinators.Count) {
  $listeners = @(Get-NetTCPConnection -State Listen -LocalPort 5173, 5174 -ErrorAction SilentlyContinue)
  if (-not $listeners.Count) {
    Write-Host 'DevFlow development services are not running.'
    exit 0
  }

  Write-Warning 'The npm run dev coordinator was not found. Stopping the processes currently listening on ports 5173 and 5174.'
  $listeners.OwningProcess | Sort-Object -Unique | ForEach-Object {
    if ($PSCmdlet.ShouldProcess("PID $_", 'Stop DevFlow port listener')) {
      Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
    }
  }
  exit 0
}

$targetIds = New-Object System.Collections.Generic.List[int]

function Add-ProcessTree([int]$processId) {
  $children = @($script:processes | Where-Object { $_.ParentProcessId -eq $processId })
  foreach ($child in $children) {
    Add-ProcessTree -processId $child.ProcessId
  }
  if (-not $script:targetIds.Contains($processId)) {
    $script:targetIds.Add($processId)
  }
}

foreach ($coordinator in $coordinators) {
  Add-ProcessTree -processId $coordinator.ProcessId
}

foreach ($processId in $targetIds) {
  if ($PSCmdlet.ShouldProcess("PID $processId", 'Stop DevFlow development process')) {
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
  }
}

Write-Host "DevFlow stop request completed for $projectRoot."
