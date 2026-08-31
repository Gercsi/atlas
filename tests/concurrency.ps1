$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$processes=1..20 | ForEach-Object {
 $number=$_
 Start-Process -FilePath 'C:\xampp\php\php.exe' -ArgumentList "$PSScriptRoot\create-one.php",$number -WorkingDirectory $root -RedirectStandardOutput "$root\work\concurrent-$number.txt" -RedirectStandardError "$root\work\concurrent-$number-error.txt" -WindowStyle Hidden -PassThru
}
$processes | Wait-Process
$ids=1..20 | ForEach-Object {[IO.File]::ReadAllText("$root\work\concurrent-$_.txt").Trim()}
$errors=1..20 | ForEach-Object {[IO.File]::ReadAllText("$root\work\concurrent-$_-error.txt").Trim()} | Where-Object {$_}
$unique=($ids|Select-Object -Unique).Count
$result=@{created=$ids.Count;unique=$unique;errors=@($errors);pass=($unique -eq 20 -and @($errors).Count -eq 0)}
$result|ConvertTo-Json | Set-Content -LiteralPath "$root\work\concurrency-results.json"
$result|ConvertTo-Json
if(-not $result.pass){exit 1}
