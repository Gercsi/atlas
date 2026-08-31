<?php

// Uses only newly created, randomly named databases. No DROP or customer data.
declare(strict_types=1);
require __DIR__.'/../vendor/autoload.php';
use Cmdb\{ApiError, Config, Installer, Schema};

$suffix = date('Ymd_His').'_'.bin2hex(random_bytes(3));
$database = 'atlas_test_'.$suffix;
$directory = str_replace('\\', '/', sys_get_temp_dir()).'/atlas-installer-'.$suffix;
mkdir($directory, 0700, true);
putenv('CMDB_CONFIG='.$directory.'/config.json');
$input = ['host' => '127.0.0.1', 'port' => (int)(getenv('CMDB_TEST_SQL_PORT') ?: 3306), 'database' => $database, 'admin_user' => getenv('CMDB_TEST_SQL_USER') ?: 'root', 'admin_password' => getenv('CMDB_TEST_SQL_PASSWORD') ?: ''];
$passed = 0;
function check(bool $ok, string $label): void {
    global $passed;
    if (!$ok) throw new RuntimeException('FAIL '.$label);
    ++$passed;
    echo 'PASS '.$label."\n";
}
function rejects(int $status, callable $callback): bool {
    try { $callback(); } catch (ApiError $e) { return $e->status === $status; }
    return false;
}

$socket = stream_socket_server('tcp://127.0.0.1:0', $errno, $message);
if (!$socket) throw new RuntimeException('Cannot reserve test port.');
$address = stream_socket_get_name($socket, false);
fclose($socket);
$process = proc_open([PHP_BINARY, '-d', 'extension=zip', '-d', 'extension=gd', '-d', 'display_errors=0', '-S', $address, '-t', 'public', 'public/router.php'], [0 => ['pipe', 'r'], 1 => ['file', $directory.'/server-out.log', 'a'], 2 => ['file', $directory.'/server-error.log', 'a']], $pipes, dirname(__DIR__), null, ['bypass_shell' => true, 'create_new_console' => false]);
if (!is_resource($process)) throw new RuntimeException('Cannot start test server.');
fclose($pipes[0]);
$cookie = '';
$csrf = '';
$request = function(string $path, string $method = 'GET', ?array $body = null, bool $token = true, ?string $host = null) use ($address, &$cookie, &$csrf): array {
    $headers = ['Content-Type: application/json', 'Cookie: '.$cookie];
    if ($token) $headers[] = 'X-CSRF-Token: '.$csrf;
    if ($host !== null) $headers[] = 'Host: '.$host;
    $context = stream_context_create(['http' => ['method' => $method, 'header' => implode("\r\n", $headers), 'content' => $body === null ? '' : json_encode($body), 'ignore_errors' => true, 'timeout' => 25]]);
    $raw = file_get_contents('http://'.$address.'/api.php?r='.$path, false, $context);
    preg_match('/\s(\d{3})\s/', $http_response_header[0], $status);
    foreach ($http_response_header as $header) if (preg_match('/^Set-Cookie: (CMDBSESSID=[^;]+)/i', $header, $match)) $cookie = $match[1];
    return [(int)$status[1], json_decode($raw, true, 64, JSON_THROW_ON_ERROR), $raw];
};
try {
    for ($i = 0; $i < 50; $i++) {
        $probe = @stream_socket_client('tcp://'.$address, $errno, $message, 0.1);
        if ($probe) { fclose($probe); break; }
        usleep(100000);
    }
    [$status, $session] = $request('session');
    check($status === 200 && $session['installation_required'] && !$session['setup_required'] && $session['user'] === null, 'fresh session works without configuration/database');
    check($session['installation']['requirements']['ready'], 'PHP preflight requirements ready');
    $csrf = $session['csrf'];
    check($request('install', 'POST', $input, false)[0] === 419, 'installation rejects missing CSRF');
    check($request('session', 'GET', null, true, 'untrusted.example')[0] === 403, 'local Host validation blocks DNS rebinding');
    check($request('setup', 'POST', ['username' => 'first_admin', 'password' => 'not-a-real-password'])[0] === 503, 'admin cannot be created before database installation');
    check($request('install', 'POST', [...$input, 'database' => 'mysql'])[0] === 422, 'system database rejected');
    check($request('install', 'POST', [...$input, 'database' => 'bad`;DROP DATABASE x'])[0] === 422, 'SQL identifier injection rejected');
    check($request('install', 'POST', [...$input, 'host' => '127.0.0.1;dbname=other'])[0] === 422, 'DSN injection rejected');
    $secret = bin2hex(random_bytes(24));
    [$status, $response, $raw] = $request('install', 'POST', [...$input, 'admin_user' => 'missing_'.bin2hex(random_bytes(6)), 'admin_password' => $secret]);
    check($status === 422 && !str_contains($raw, $secret) && !Config::exists(), 'bad SQL credentials do not leak secrets or activate config');
    $lock = fopen($directory.'/installation.lock', 'c');
    flock($lock, LOCK_EX);
    check($request('install', 'POST', $input)[0] === 409, 'concurrent installation is locked');
    flock($lock, LOCK_UN); fclose($lock);
    [$status, $response] = $request('install', 'POST', $input);
    check($status === 201 && $response['setup_required'], 'new database and runtime account installed');
    $config = Config::read();
    $savedConfig = file_get_contents(Config::path());
    check($config['db_user'] !== $input['admin_user'] && strlen($config['db_password']) === 64 && $config['source'] === null, 'dedicated random runtime credentials; no import source');
    check(!array_key_exists('admin_password', $config), 'SQL administrator credentials not persisted');
    $db = new PDO($config['dsn'], $config['db_user'], $config['db_password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    foreach ([...Schema::TYPES, 'users'] as $table) check((int)$db->query("SELECT COUNT(*) FROM `$table`")->fetchColumn() === 0, 'empty '.$table);
    $grants = implode("\n", $db->query('SHOW GRANTS')->fetchAll(PDO::FETCH_COLUMN));
    check(!preg_match('/GRANT (?!USAGE)[^\n]+ ON \*\.\*/', $grants) && !str_contains($grants, 'WITH GRANT OPTION'), 'runtime has no global or delegation privileges');
    $root = new PDO('mysql:host=127.0.0.1;port='.$input['port'].';charset=utf8mb4', $input['admin_user'], $input['admin_password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $otherDatabase = str_replace('_', 'x', $database);
    $root->exec("CREATE DATABASE `$otherDatabase`");
    $root->exec("CREATE TABLE `$otherDatabase`.sentinel (id INT PRIMARY KEY)");
    $root->exec("INSERT INTO `$otherDatabase`.sentinel VALUES (73)");
    try { $db->query("SELECT * FROM `$otherDatabase`.sentinel"); $denied = false; } catch (PDOException) { $denied = true; }
    check($denied, 'underscores in database grants cannot access similarly named databases');
    putenv('CMDB_CONFIG='.$directory.'/other/config.json');
    check(rejects(409, fn() => Installer::install([...$input, 'database' => $otherDatabase])), 'existing populated database installation refused');
    check((int)$root->query("SELECT id FROM `$otherDatabase`.sentinel")->fetchColumn() === 73, 'existing data unchanged');
    putenv('CMDB_CONFIG='.$directory.'/config.json');
    check($request('install', 'POST', $input)[0] === 409 && file_get_contents(Config::path()) === $savedConfig, 'reinstallation cannot overwrite config');
    [$status, $session] = $request('session');
    check($status === 200 && !$session['installation_required'] && $session['setup_required'], 'next step is first administrator');
    $admin = ['username' => 'first_admin', 'password' => bin2hex(random_bytes(18))];
    check($request('setup', 'POST', [...$admin, 'password' => 'short'])[0] === 422, 'weak first-admin password rejected');
    check($request('setup', 'POST', $admin, false)[0] === 419, 'first-admin setup requires CSRF');
    check($request('setup', 'POST', $admin)[0] === 200, 'first admin creation succeeds');
    check($request('setup', 'POST', [...$admin, 'username' => 'second_admin'])[0] === 403, 'public setup closes after first admin');
    $row = $db->query('SELECT * FROM users')->fetch(PDO::FETCH_ASSOC);
    check($row['role'] === 'admin' && password_verify($admin['password'], $row['password_hash']) && $row['password_hash'] !== $admin['password'], 'admin role and hashed password persisted');
    check($request('login', 'POST', $admin)[0] === 200, 'new admin can log in');
    [$status, $dashboard] = $request('dashboard');
    check($status === 200 && array_sum($dashboard['counts']) === 0, 'first dashboard contains no business data');
    check($request('metadata')[0] === 200, 'new admin can read metadata');
    check($request('imports/preview', 'POST', [])[0] === 422, 'empty installation requests an explicit import file');
    check($request('logout', 'POST', null, false)[0] === 419, 'logout still requires CSRF');
    check($request('dashboard')[0] === 200, 'rejected logout does not end authentication');
    check($request('logout', 'POST')[0] === 200, 'authenticated logout succeeds');
    [$status, $session] = $request('session');
    check($status === 200 && $session['user'] === null && $csrf !== $session['csrf'], 'logout removes user and rotates CSRF');
    $csrf = $session['csrf'];
    check($request('logout', 'POST')[0] === 200, 'logout is idempotent for anonymous users');
    [, $session] = $request('session');
    $csrf = $session['csrf'];
    check($request('login', 'POST', $admin)[0] === 200, 'same browser can log in again after logout');
    // Expire ONLY the session created by this isolated HTTP test client.
    // No production session/cookie/configuration is read or changed.
    $testSessionId = substr($cookie, strlen('CMDBSESSID='));
    if (!preg_match('/^[A-Za-z0-9,-]+$/D', $testSessionId)) throw new RuntimeException('Invalid synthetic session ID.');
    $testSessionPath = $directory.'/sessions/sess_'.$testSessionId;
    $expiredSession = preg_replace('/last_seen\|i:[0-9]+;/', 'last_seen|i:'.(time() - 3601).';', file_get_contents($testSessionPath), 1, $changes);
    check($changes === 1, 'synthetic inactivity timeout prepared');
    file_put_contents($testSessionPath, $expiredSession);
    check($request('dashboard')[0] === 401, 'one-hour inactivity rejects protected reads');
    check($request('logout', 'POST')[0] === 200, 'logout works after inactivity timeout');
    $cookie = '';
    check($request('logout', 'POST')[0] === 419, 'lost session cookie rejects old CSRF');
    [, $session] = $request('session');
    $csrf = $session['csrf'];
    check($request('logout', 'POST')[0] === 200, 'fresh CSRF makes logout work after cookie loss');
    check($request('exports/test/download')[0] === 401, 'anonymous export download remains protected');
    [, $session] = $request('session');
    $csrf = $session['csrf'];
    check($request('login', 'POST', $admin)[0] === 200, 'login works after full session loss');
    file_put_contents(Config::path(), '{broken');
    check($request('session')[0] === 503 && $request('install', 'POST', $input)[0] === 503, 'malformed existing config fails closed');
    file_put_contents(Config::path(), json_encode([...$config, 'db_password' => bin2hex(random_bytes(24))]));
    check($request('session')[0] === 503 && $request('install', 'POST', $input)[0] === 409, 'database outage never reopens installation');
    file_put_contents(Config::path(), $savedConfig);
    check($request('session')[0] === 200, 'repaired config reconnects without reinstallation');
    check(!str_contains(file_get_contents($directory.'/server-error.log'), $secret), 'submitted SQL password absent from server logs');
    putenv('CMDB_CONFIG='.dirname(__DIR__).'/work/unsafe/config.json');
    check(rejects(503, fn() => Config::ensurePrivateDirectory(Config::directory())), 'private storage inside project rejected');
    putenv('CMDB_CONFIG='.$directory.'/config.json');
    echo "$passed checks passed. Synthetic databases retained for inspection.\n";
} finally {
    if (isset($savedConfig)) file_put_contents($directory.'/config.json', $savedConfig);
    proc_terminate($process);
    proc_close($process);
}
