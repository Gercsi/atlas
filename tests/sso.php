<?php

declare(strict_types=1);

require __DIR__.'/../vendor/autoload.php';
require __DIR__.'/bootstrap.php';

$projectRandomState = dirname(__DIR__).'/.rnd';
$randomStateExisted = file_exists($projectRandomState);
register_shutdown_function(static function () use ($projectRandomState, $randomStateExisted): void {
    if (!$randomStateExisted && is_file($projectRandomState)) {
        @unlink($projectRandomState);
    }
});

use Cmdb\{ApiError, App, Schema, SecretStore, Sso};
use Firebase\JWT\JWT;

$config = atlasTestDatabase('atlas_sso_test_');
file_put_contents($config['storage'].'/config.json', json_encode($config, JSON_THROW_ON_ERROR));
putenv('CMDB_CONFIG='.$config['storage'].'/config.json');
putenv('RANDFILE='.$config['storage'].'/.rnd');
$app = new App();
Schema::migrate($app->db);
$adminId = App::id();
$app->run('INSERT INTO users VALUES (?,?,?,?,?,1)', [$adminId,'qa_admin',password_hash('synthetic-password', PASSWORD_DEFAULT),'admin','[]']);
$app->user = $app->one('SELECT * FROM users WHERE id=?', [$adminId]);
$sso = new Sso($app);
$passed = 0;
$check = function (bool $condition, string $label) use (&$passed): void {
    if (!$condition) {
        throw new RuntimeException('FAIL '.$label);
    }
    ++$passed;
    echo 'PASS '.$label."\n";
};
$rejects = function (int $status, callable $callable) use ($check): void {
    try {
        $callable();
    } catch (ApiError $e) {
        $check($e->status === $status, 'expected rejection '.$status);
        return;
    }
    throw new RuntimeException('Expected API error '.$status);
};

$check($sso->publicStatus()['enabled'] === false, 'SSO is disabled by default');
$tenant = '11111111-1111-4111-8111-111111111111';
$saved = $sso->save([
    'enabled' => true,'provider_type' => 'entra','display_name' => 'Belépés Entra ID-val','tenant_id' => $tenant,
    'client_id' => '22222222-2222-4222-8222-222222222222','client_secret' => 'test-only-client-secret',
    'allowed_email_domains' => "example.com\nexample.com",'required_group_id' => 'group-allowed','auto_provision' => true,
    'default_role' => 'viewer','default_capabilities' => ['export_diagram','admin','export_diagram'],
], 'http://127.0.0.1:9999/api.php?r=sso/callback');
$row = $app->one('SELECT * FROM sso_settings WHERE id=1');
$check($saved['enabled'] && $saved['client_secret_configured'] && !array_key_exists('client_secret_encrypted', $saved), 'admin response exposes only secret presence');
$check(!str_contains($row['client_secret_encrypted'], 'test-only-client-secret') && SecretStore::decrypt($row['client_secret_encrypted'], 'atlas-sso-client-secret-v1') === 'test-only-client-secret', 'client secret encrypted at rest');
$check(is_file($config['storage'].'/application.key') && strlen(file_get_contents($config['storage'].'/application.key')) === 32, 'encryption key stored separately');
$check(json_decode($row['allowed_email_domains'], true) === ['example.com'] && json_decode($row['default_capabilities'], true) === ['export_diagram'], 'domains and capabilities normalized');

chdir($config['storage']);
$key = openssl_pkey_new(['private_key_bits' => 2048,'private_key_type' => OPENSSL_KEYTYPE_RSA,'config' => 'C:/xampp/php/extras/openssl/openssl.cnf']);
if (!$key) {
    throw new RuntimeException('RSA test key generation failed.');
}
if (!openssl_pkey_export($key, $privateKey, null, ['config' => 'C:/xampp/php/extras/openssl/openssl.cnf'])) {
    throw new RuntimeException('RSA test key export failed.');
}
$details = openssl_pkey_get_details($key);
$b64 = fn (string $value): string => rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
$jwks = ['keys' => [['kty' => 'RSA','use' => 'sig','kid' => 'test-key','alg' => 'RS256','n' => $b64($details['rsa']['n']),'e' => $b64($details['rsa']['e'])]]];
$now = time();
$issuer = 'https://login.microsoftonline.com/'.$tenant.'/v2.0';
$settings = ['provider_type' => 'entra','tenant_id' => $tenant,'client_id' => '22222222-2222-4222-8222-222222222222'];
$claims = ['iss' => $issuer,'aud' => $settings['client_id'],'sub' => 'pairwise-subject','oid' => 'object-id-1','tid' => $tenant,'nonce' => 'expected-nonce','iat' => $now,'nbf' => $now - 1,'exp' => $now + 300,'preferred_username' => 'qa_admin@example.com','email' => 'qa_admin@example.com','groups' => ['group-allowed']];
$token = JWT::encode($claims, $privateKey, 'RS256', 'test-key');
$verified = Sso::verifyIdToken($token, ['issuer' => $issuer], $jwks, $settings, 'expected-nonce', $now);
$check($verified['oid'] === 'object-id-1', 'signed ID token validated');
$badAudience = JWT::encode([...$claims,'aud' => 'other-client'], $privateKey, 'RS256', 'test-key');
$rejects(401, fn () => Sso::verifyIdToken($badAudience, ['issuer' => $issuer], $jwks, $settings, 'expected-nonce', $now));
$badNonce = JWT::encode([...$claims,'nonce' => 'replayed'], $privateKey, 'RS256', 'test-key');
$rejects(401, fn () => Sso::verifyIdToken($badNonce, ['issuer' => $issuer], $jwks, $settings, 'expected-nonce', $now));
$missingExpiry = $claims;
unset($missingExpiry['exp']);
$rejects(401, fn () => Sso::verifyIdToken(JWT::encode($missingExpiry, $privateKey, 'RS256', 'test-key'), ['issuer' => $issuer], $jwks, $settings, 'expected-nonce', $now));

$external = $sso->resolveUser($verified);
$check($external['username'] !== 'qa_admin' && str_starts_with($external['username'], 'qa_admin-') && $external['role'] === 'viewer', 'provisioning never links matching local username');
$same = $sso->resolveUser($verified);
$check($same['id'] === $external['id'] && (int)$app->db->query('SELECT COUNT(*) FROM user_identities')->fetchColumn() === 1, 'external subject mapping is stable and unique');
$rejects(403, fn () => $sso->resolveUser([...$verified,'oid' => 'object-id-2','email' => 'person@blocked.invalid','preferred_username' => 'person@blocked.invalid']));
$rejects(403, fn () => $sso->resolveUser([...$verified,'oid' => 'object-id-3','groups' => [],'email' => 'person@example.com','preferred_username' => 'person@example.com']));
$rejects(403, fn () => $sso->resolveUser([...$verified,'oid' => 'object-id-4','groups' => null,'hasgroups' => true,'email' => 'person@example.com','preferred_username' => 'person@example.com']));

$sso->save([...$saved,'client_secret' => '','allowed_email_domains' => ['example.com'],'auto_provision' => false,'default_capabilities' => []], 'http://127.0.0.1:9999/api.php?r=sso/callback');
$check(SecretStore::decrypt($app->one('SELECT client_secret_encrypted FROM sso_settings WHERE id=1')['client_secret_encrypted'], 'atlas-sso-client-secret-v1') === 'test-only-client-secret', 'blank admin secret preserves existing encrypted value');
$rejects(403, fn () => $sso->resolveUser([...$verified,'oid' => 'object-id-5','email' => 'new@example.com','preferred_username' => 'new@example.com']));

echo "$passed SSO checks passed. Synthetic database retained for inspection.\n";
