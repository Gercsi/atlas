<?php

require __DIR__.'/../vendor/autoload.php';
use Cmdb\{App,Schema,Exporter,Importer};

$sourceConfig = trim(file_get_contents(__DIR__.'/../work/test-config-path.txt'));
putenv('CMDB_CONFIG='.$sourceConfig);
$source = new App();
$source->user = $source->one("SELECT * FROM users WHERE role='admin' LIMIT 1");
$snapshot = (new Exporter($source))->snapshot(['types' => Schema::TYPES,'scope' => 'all']);
$file = $source->config['storage'].'/roundtrip.xlsx';
(new Exporter($source))->xlsx($snapshot, $file);
require __DIR__.'/bootstrap.php';
$conf = atlasTestDatabase('atlas_roundtrip_test_');
$dir = $conf['storage'];
file_put_contents($dir.'/config.json', json_encode($conf));
putenv('CMDB_CONFIG='.$dir.'/config.json');
$target = new App();
Schema::migrate($target->db);
$target->user = ['id' => null,'role' => 'admin','capabilities' => '[]'];
$preview = (new Importer($target))->preview($file);
$result = (new Importer($target))->commit($preview['id']);
$back = (new Exporter($target))->snapshot(['types' => Schema::TYPES,'scope' => 'all']);
$checks = [];
foreach (Schema::TYPES as $t) {
    $same = $snapshot[$t]['rows'] === $back[$t]['rows'];
    $checks[$t] = $same;
    if (!$same) {
        echo "DIFFERENCE $t\n";
        file_put_contents($dir.'/diff-'.$t.'.json', json_encode(['before' => $snapshot[$t],'after' => $back[$t]], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }
}
foreach (['ApplicationContacts','ServerContacts','DatabaseContacts','ApplicationBusinessAreas','ConnectionEndpoints','ConnectionServices','IntegrationConnections'] as $t) {
    $left = $snapshot[$t]['rows'];
    $right = $back[$t]['rows'];
    $checks[$t] = $left === $right;
}
echo json_encode($checks, JSON_PRETTY_PRINT)."\n";
file_put_contents(__DIR__.'/../work/roundtrip-results.json', json_encode($checks, JSON_PRETTY_PRINT));
exit(in_array(false, $checks, true) ? 1 : 0);
