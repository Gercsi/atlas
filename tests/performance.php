<?php

require __DIR__.'/../vendor/autoload.php';
putenv('CMDB_CONFIG='.trim(file_get_contents(__DIR__.'/../work/test-config-path.txt')));
$a = new Cmdb\App();
$a->user = $a->one("SELECT * FROM users WHERE role='admin' LIMIT 1");
if (($argv[1] ?? '') === 'seed') {
    $a->tx(function () use ($a) {
        $s = $a->db->prepare("INSERT INTO applications(id,public_id,name,environment,created_at,updated_at) VALUES (?,?,?,'PROD',UTC_TIMESTAMP(),UTC_TIMESTAMP())");
        for ($i = 1;$i <= 10000;$i++) {
            $s->execute([Cmdb\App::id(),'APP-PERF-'.str_pad((string)$i, 5, '0', STR_PAD_LEFT),'Synthetic performance record '.$i]);
        }
    });
    echo "10000 synthetic records inserted\n";
    exit;
}
$times = [];
for ($i = 0;$i < 50;$i++) {
    $start = hrtime(true);
    $a->listing('applications', ['q' => 'performance','page' => ($i % 100) + 1,'per_page' => 25]);
    $times[] = (hrtime(true) - $start) / 1e6;
}echo json_encode($times);
