<?php

declare(strict_types=1);

/** Provision only a new synthetic database. Never use the application config. */
function atlasTestDatabase(string $prefix): array
{
    if (!preg_match('/^[a-z_]+$/D', $prefix)) throw new RuntimeException('Invalid test prefix.');
    $name = $prefix.date('Ymd_His').'_'.bin2hex(random_bytes(3));
    $user = getenv('CMDB_TEST_SQL_USER') ?: 'root';
    $password = getenv('CMDB_TEST_SQL_PASSWORD') ?: '';
    $port = (int)(getenv('CMDB_TEST_SQL_PORT') ?: 3306);
    $root = new PDO("mysql:host=127.0.0.1;port=$port;charset=utf8mb4", $user, $password, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $root->exec("CREATE DATABASE `$name` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $dir = str_replace('\\', '/', sys_get_temp_dir()).'/atlas-tests/'.$name;
    mkdir($dir, 0700, true);
    if (!is_dir(__DIR__.'/../work')) mkdir(__DIR__.'/../work', 0700, true);
    return ['dsn' => "mysql:host=127.0.0.1;port=$port;dbname=$name;charset=utf8mb4", 'db_user' => $user, 'db_password' => $password, 'storage' => $dir, 'source' => null];
}
