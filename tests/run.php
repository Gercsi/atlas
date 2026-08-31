<?php

// Synthetic integration tests. Creates a separate database; never deletes customer data.
require __DIR__.'/../vendor/autoload.php';
use Cmdb\{App,Schema,ApiError,Exporter,Graph};

require __DIR__.'/bootstrap.php';
$config = atlasTestDatabase('atlas_crud_test_');
$dir = $config['storage'];
$dbName = basename($dir);
file_put_contents($dir.'/config.json', json_encode($config));
putenv('CMDB_CONFIG='.$dir.'/config.json');
$a = new App();
Schema::migrate($a->db);
$password = bin2hex(random_bytes(18));
$uid = App::id();
$a->run('INSERT INTO users VALUES (?,?,?,?,?,1)', [$uid,'qa_admin',password_hash($password, PASSWORD_DEFAULT),'admin','[]']);
$a->user = $a->one('SELECT * FROM users WHERE id=?', [$uid]);
file_put_contents($dir.'/browser-login.json', json_encode(['username' => 'qa_admin','password' => $password]));
file_put_contents(__DIR__.'/../work/test-config-path.txt', $dir.'/config.json');
$results = [];
$test = function (string $name, callable $fn) use (&$results) {
    try {
        $fn();
        $results[] = ['test' => $name,'status' => 'PASS'];
        echo "PASS $name\n";
    } catch (Throwable $e) {
        $results[] = ['test' => $name,'status' => 'FAIL','error' => $e->getMessage()];
        echo "FAIL $name: ".$e->getMessage()."\n";
    }
};
$assert = function ($condition, $message = 'Assertion failed') {
    if (!$condition) {
        throw new RuntimeException($message);
    }
};
$expect = function (int $status, callable $fn) use ($assert) {
    try {
        $fn();
        throw new RuntimeException('Expected '.$status);
    } catch (ApiError $e) {
        $assert($e->status === $status, 'Wrong status '.$e->status);
    }
};
$s1 = $a->save('servers', ['name' => 'QA platform 01','environment' => 'PROD','cpu' => 4,'ram_gib' => 16]);
$s2 = $a->save('servers', ['name' => 'QA data 02','environment' => 'PROD']);
$s3 = $a->save('servers', ['name' => 'QA integration 03','environment' => 'TEST']);
$app = $a->save('applications', ['name' => 'Műhely — Áttekintés','environment' => 'PROD','server_id' => $s1['id'],'notes' => "=HYPERLINK(\"https://invalid.example\")\nMásodik sor"]);
$app2 = $a->save('applications', ['name' => 'Raktár','environment' => 'PROD','server_id' => $s2['id']]);
$app3 = $a->save('applications', ['name' => 'Teszt portál','environment' => 'TEST','server_id' => $s3['id']]);
$db = $a->save('databases', ['name' => 'Üzemi adatok','engine' => 'PostgreSQL','application_id' => $app['id'],'server_id' => $s2['id'],'backup_enabled' => false,'replication_enabled' => null]);
$contact = $a->save('contacts', ['name' => 'Szintetikus Kapcsolattartó','email' => 'qa@example.invalid','phone' => '+36 00 000 0000','contact_type' => 'person']);
$int = $a->save('integrations', ['source_application_id' => $app['id'],'target_application_id' => $app2['id'],'interface_type' => 'REST','protocol' => 'HTTPS']);
$net = $a->save('network_connections', ['name' => 'Dokumentált QA szabály','connection_type' => 'firewall_rule','action' => 'allow','status' => 'active','transport_protocol' => 'tcp','source_ports_mode' => 'any','destination_ports_mode' => 'specified','endpoints' => [['side' => 'source','endpoint_kind' => 'server','server_id' => $s1['id']],['side' => 'target','endpoint_kind' => 'server','server_id' => $s2['id']]],'services' => [['side' => 'destination','port_from' => 443,'port_to' => 443]]]);
$test('A01 six registries persist and read', function () use ($a, $assert) {
    foreach (Schema::TYPES as $t) {
        $assert($a->listing($t, [])['meta']['total'] > 0, $t);
    }
});
$test('A02 one contact two independent roles', function () use ($a, $app, $app2, $contact, $assert) {
    foreach ([[$app,'support'],[$app2,'business_owner']] as [$r,$role]) {
        $a->run('INSERT INTO applications_contacts VALUES (?,?,?,?,?,0,NULL)', [App::id(),$r['id'],$contact['id'],$role,'Szintetikus szerep']);
    }$assert(count($a->relationships('contacts', $contact['id'])['applications']) === 2);
});
$test('A03 strict 0..1 app-database uniqueness', fn () => $expect(422, fn () => $a->save('databases', ['name' => 'Duplicate DB','engine' => 'SQL','application_id' => $app['id']])));
$test('A04 independent application and DB hosts', function () use ($a, $app, $db, $s1, $s2, $assert) {
    $assert($a->get('applications', $app['id'])['server_id'] === $s1['id']);
    $assert($a->get('databases', $db['id'])['server_id'] === $s2['id']);
    $g = (new Graph($a))->query([]);
    $n = array_column($g['nodes'], null, 'id');
    $assert($n[$db['id']]['parent'] === 'group-'.$s2['id']);
});
$test('A06 optimistic edit 409 and no lost update', function () use ($a, $app, $expect, $assert) {
    $a->save('applications', ['name' => 'Műhely — javított','lock_version' => 1], $app['id']);
    $expect(409, fn () => $a->save('applications', ['name' => 'Elvesző változat','lock_version' => 1], $app['id']));
    $assert($a->get('applications', $app['id'])['name'] === 'Műhely — javított');
});
$test('A14 strict server selection', function () use ($a, $s1, $assert) {
    $g = (new Graph($a))->query(['view' => 'servers','server_ids' => [$s1['id']]]);
    $assert(count($g['nodes']) === 1);
    $assert(count($g['edges']) === 0);
});
$test('A15 one hop and hard environment boundary', function () use ($a, $app2, $app3, $s1, $s2, $s3, $assert) {
    $a->save('integrations', ['source_application_id' => $app2['id'],'target_application_id' => $app3['id']]);
    $g = (new Graph($a))->query(['view' => 'servers','server_ids' => [$s1['id']],'mode' => 'neighbors','hops' => 1,'environment' => 'PROD']);
    $ids = array_column($g['nodes'], 'id');
    $assert(in_array($s2['id'], $ids));
    $assert(!in_array($s3['id'], $ids));
});
$test('A16-A17 aggregation preserves direction and members', function () use ($a, $app, $app2, $s1, $s2, $assert) {
    $a->save('integrations', ['source_application_id' => $app['id'],'target_application_id' => $app2['id']]);
    $a->save('integrations', ['source_application_id' => $app2['id'],'target_application_id' => $app['id']]);
    $g = (new Graph($a))->query(['view' => 'servers']);
    $forward = array_values(array_filter($g['edges'], fn ($e) => $e['source'] === $s1['id'] && $e['target'] === $s2['id']));
    $assert($forward[0]['count'] === 2);
    $assert(count($forward[0]['entity_ids']) === 2);
    $assert(count(array_filter($g['edges'], fn ($e) => $e['source'] === $s2['id'] && $e['target'] === $s1['id'])) === 1);
});
$test('A18 active endpoints and ICMP validation', function () use ($a, $expect) {
    $expect(422, fn () => $a->save('network_connections', ['name' => 'Invalid','connection_type' => 'firewall_rule','action' => 'allow','status' => 'active','transport_protocol' => 'tcp']));
    $expect(422, fn () => $a->save('network_connections', ['name' => 'Invalid ICMP','connection_type' => 'direct_flow','action' => 'unknown','status' => 'planned','transport_protocol' => 'icmp','services' => [['side' => 'destination','port_from' => 80,'port_to' => 80]]]));
});
$test('A22 partial export excludes other business sheets', function () use ($a, $assert) {
    $e = new Exporter($a);
    $tables = $e->snapshot(['types' => ['applications','integrations'],'scope' => 'all']);
    $assert(isset($tables['applications'],$tables['integrations']));
    $assert(!isset($tables['servers'],$tables['contacts'],$tables['databases']));
    $e->xlsx($tables, $a->config['storage'].'/partial.xlsx');
});
$test('A24-A25 formula safe XLSX and multiline CSV', function () use ($a, $assert) {
    $e = new Exporter($a);
    $t = $e->snapshot(['types' => Schema::TYPES,'scope' => 'all']);
    $e->xlsx($t, $a->config['storage'].'/full.xlsx');
    $e->csv($t, $a->config['storage'].'/full.zip');
    $r = new PhpOffice\PhpSpreadsheet\Reader\Xlsx();
    $wb = $r->load($a->config['storage'].'/full.xlsx');
    $sh = $wb->getSheetByName('contacts');
    $headers = $sh->rangeToArray('A1:Z1', null, false, false)[0];
    $col = array_search('phone', $headers) + 1;
    $assert($sh->getCell([$col,2])->getDataType() === 's');
    $assert($sh->getCell([$col,2])->getValue() === '+36 00 000 0000');
    $z = new ZipArchive();
    $z->open($a->config['storage'].'/full.zip');
    $csv = $z->getFromName('applications.csv');
    $assert(str_contains($csv, "'=HYPERLINK"));
    $assert(str_contains($csv, 'Második sor'));
    $z->close();
});
$test('A27 viewer permission and contact redaction', function () use ($a, $contact, $expect, $assert) {
    $admin = $a->user;
    $a->user = ['id' => App::id(),'role' => 'viewer','capabilities' => '[]'];
    $expect(403, fn () => $a->need('edit'));
    $expect(403, fn () => $a->need('export_data'));
    $r = $a->get('contacts', $contact['id']);
    $assert(!isset($r['email'],$r['phone'],$r['notes']));
    $a->user = $admin;
});
$test('A30 failed FK transaction leaves no partial record', function () use ($a, $assert) {
    $n = $a->listing('servers', [])['meta']['total'];
    try {
        $a->save('servers', ['name' => 'Bad child FK','environment' => 'PROD','addresses' => [['address' => '192.0.2.9','zone_id' => App::id(),'is_primary' => 1]]]);
    } catch (Throwable $e) {
    }$assert($a->listing('servers', [])['meta']['total'] === $n);
});
$test('Stable public ID after environment rename', function () use ($a, $s3, $assert) {
    $r = $a->save('servers',['environment' => 'UAT','lock_version' => 1],$s3['id']);
    $assert($r['public_id'] === $s3['public_id']);
});
file_put_contents(__DIR__.'/../work/test-results.json',json_encode(['database' => $dbName,'config' => $dir.'/config.json','results' => $results],JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
echo "TEST_CONFIG=$dir/config.json\n";
exit(count(array_filter($results,fn ($r) => $r['status'] === 'FAIL')) ? 1 : 0);
