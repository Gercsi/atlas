<?php

require __DIR__.'/../vendor/autoload.php';
putenv('CMDB_CONFIG='.trim(file_get_contents(__DIR__.'/../work/test-config-path.txt')));
$a = new Cmdb\App();
$a->user = $a->one("SELECT * FROM users WHERE role='admin' LIMIT 1");
$r = $a->save('contacts', ['name' => 'Concurrency fixture '.$argv[1]]);
echo $r['public_id'];
