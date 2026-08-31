<?php
require __DIR__.'/../vendor/autoload.php';
putenv('CMDB_CONFIG='.trim(file_get_contents(__DIR__.'/../work/test-config-path.txt')));
$a=new Cmdb\App;$a->user=$a->one("SELECT * FROM users WHERE role='admin' LIMIT 1");
$job=(new Cmdb\Exporter($a))->create(['types'=>['applications','integrations'],'format'=>'xlsx','scope'=>'all']);
(new Cmdb\Exporter($a))->process($job['id']);
$result=$a->one('SELECT status,path FROM jobs WHERE id=?',[$job['id']]);
if($result['status']!=='completed'||!is_file($result['path']))throw new RuntimeException('Export job failed.');
echo "PASS queued export -> running -> completed -> file exists\n";
