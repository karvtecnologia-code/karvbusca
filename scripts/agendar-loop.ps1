# Agenda o robô da Loop no seu PC (a Loop bloqueia os IPs do GitHub Actions).
# Roda 07:05, 12:05 e 18:05, só a Loop, com as chaves do apps\web\.env.local.
# Uso (PowerShell, dentro de D:\Karv\Buscador):   .\scripts\agendar-loop.ps1
# Para remover:   Unregister-ScheduledTask -TaskName "KarvBusca Loop" -Confirm:$false

$raiz = Split-Path -Parent $PSScriptRoot
$pnpm = (Get-Command pnpm).Source
$log = Join-Path $raiz "packages\scraper\artifacts\loop-agendado.log"
New-Item -ItemType Directory -Force (Split-Path $log) | Out-Null

$acao = New-ScheduledTaskAction -Execute "powershell.exe" -WorkingDirectory "$raiz\packages\scraper" `
  -Argument "-NoProfile -WindowStyle Hidden -Command `"& '$pnpm' start --sites=loop *>> '$log'`""

$gatilhos = @(
  New-ScheduledTaskTrigger -Daily -At 07:05
  New-ScheduledTaskTrigger -Daily -At 12:05
  New-ScheduledTaskTrigger -Daily -At 18:05
)
# roda assim que possível se o PC estava desligado no horário; só com internet
$opcoes = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

Register-ScheduledTask -TaskName "KarvBusca Loop" -Action $acao -Trigger $gatilhos -Settings $opcoes `
  -Description "KarvBusca: coleta da Loop Leilões (roda no PC porque a Loop bloqueia IP de datacenter)" -Force | Out-Null

Write-Host "Tarefa 'KarvBusca Loop' criada: 07:05, 12:05 e 18:05. Log em $log"
