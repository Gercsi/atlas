$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
& 'C:\xampp\php\php.exe' "$PSScriptRoot\performance.php" seed
$workers=1..10 | ForEach-Object {Start-Process -FilePath 'C:\xampp\php\php.exe' -ArgumentList "$PSScriptRoot\performance.php" -WorkingDirectory $root -RedirectStandardOutput "$root\work\perf-$_.json" -RedirectStandardError "$root\work\perf-$_-error.txt" -WindowStyle Hidden -PassThru}
$workers | Wait-Process
$times=@(1..10 | ForEach-Object {[IO.File]::ReadAllText("$root\work\perf-$_.json")|ConvertFrom-Json} | ForEach-Object {$_} | Sort-Object)
$result=@{readers=10;requests=$times.Count;synthetic_records=10000;p95_ms=[math]::Round($times[[math]::Ceiling($times.Count*.95)-1],2);median_ms=[math]::Round($times[[math]::Floor($times.Count*.5)],2);scope='Service+SQL, no HTTP transport; native local MariaDB, not constrained 2vCPU profile'}
$result|ConvertTo-Json | Set-Content -LiteralPath "$root\work\api-performance.json"
$result|ConvertTo-Json
