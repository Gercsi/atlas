<?php

namespace Cmdb;

final class Graph
{
    public function __construct(private App $a)
    {
    }
    public function query(array $c): array
    {
        $view = $c['view'] ?? 'infrastructure';
        if (!in_array($view, ['infrastructure','applications','servers','network'])) {
            throw new ApiError(422, 'Ismeretlen diagramnézet.');
        }$env = $c['environment'] ?? '';
        $tables = [];
        foreach (['servers','applications','databases','integrations','network_connections'] as $t) {
            $rows = $this->a->all("SELECT * FROM `$t`".(empty($c['archived']) ? ' WHERE archived_at IS NULL' : ''));
            $tables[$t] = array_column($rows, null, 'id');
        }
        $servers = $tables['servers'];
        $apps = $tables['applications'];
        $dbs = $tables['databases'];
        $nodes = [];
        $edges = [];
        $warnings = [];
        $unprojected = [];
        $omitted = 0;
        $allowEnv = fn ($r) => !$env || ($r['environment'] ?? null) === $env;
        $base = [];
        foreach ($servers as $id => $s) {
            if ($allowEnv($s)) {
                $base[$id] = true;
            }
        }
        $selected = array_values(array_filter($c['server_ids'] ?? [], fn ($id) => isset($base[$id])));
        $allowed = $selected ? array_fill_keys($selected, true) : $base;
        $ints = array_filter($tables['integrations'], fn ($i) => (empty($c['criticality']) || $i['criticality'] === $c['criticality']) && (empty($c['status']) || $i['status'] === $c['status'] || (!empty($c['include_unknown']) && $i['status'] === null)));
        if ($selected && ($c['mode'] ?? 'selected') === 'neighbors') {
            for ($step = 0;$step < min(2, max(1, (int)($c['hops'] ?? 1)));$step++) {
                $next = $allowed;
                foreach ($ints as $i) {
                    $s = $apps[$i['source_application_id']]['server_id'] ?? null;
                    $t = $apps[$i['target_application_id']]['server_id'] ?? null;
                    if (isset($allowed[$s]) && isset($base[$t])) {
                        $next[$t] = true;
                    }if (isset($allowed[$t]) && isset($base[$s])) {
                        $next[$s] = true;
                    }
                }$allowed = $next;
            }
        }
        $add = function (string $id, string $type, string $label, ?string $parent = null, array $extra = []) use (&$nodes) {
            $nodes[$id] = ['id' => $id,'entity_type' => $type,'entity_id' => $id,'label' => $label,'parent' => $parent,...$extra];
        };
        $zones = $this->a->all('SELECT * FROM network_zones');
        $unknown = null;
        foreach ($zones as $z) {
            if ($z['scope'] === 'unknown') {
                $unknown = $z['id'];
            }
        }
        $groups = ($c['groups'] ?? true) && in_array($view, ['infrastructure','network']);
        $zoneGroups = $view === 'network';
        $ensureZone = function (?string $id) use (&$nodes, $zones, $unknown, $add) {
            $id = $id ?: $unknown;
            foreach ($zones as $z) {
                if ($z['id'] === $id) {
                    $add('zone-'.$id, 'zone', $z['name'].' · '.$z['scope'], null, ['entity_id' => $id,'color' => $z['color']]);
                    break;
                }
            }return 'zone-'.$id;
        };
        foreach ($servers as $id => $s) {
            if (isset($allowed[$id]) && $view !== 'applications') {
                $parent = $zoneGroups ? $ensureZone($s['primary_network_zone_id']) : null;
                if ($groups) {
                    $add('group-'.$id, 'group', $s['name'] ?: $s['public_id'], $parent, ['entity_id' => $id]);
                    $parent = 'group-'.$id;
                }$add($id, 'servers', $s['name'] ?: $s['public_id'], $parent, ['public_id' => $s['public_id'],'environment' => $s['environment'],'data_quality' => $s['data_quality_status'],'neighbor' => $selected && !in_array($id, $selected)]);
            }
        }
        if (in_array($view, ['infrastructure','applications'])) {
            foreach ($apps as $id => $app) {
                if (!$allowEnv($app) || ($selected && !isset($allowed[$app['server_id']]))) {
                    continue;
                }$parent = null;
                if ($groups) {
                    if ($app['server_id'] && isset($allowed[$app['server_id']])) {
                        $parent = 'group-'.$app['server_id'];
                    } else {
                        $parent = 'unassigned';
                        $add($parent, 'group', 'Nincs szerver hozzárendelve');
                    }
                }$add($id, 'applications', $app['name'] ?: $app['public_id'], $parent, ['public_id' => $app['public_id'],'environment' => $app['environment'],'data_quality' => $app['data_quality_status']]);
            }
            if ($view === 'infrastructure' && ($c['databases'] ?? true)) {
                foreach ($dbs as $id => $d) {
                    if ($selected && !isset($allowed[$d['server_id']])) {
                        continue;
                    }$parent = $groups ? ($d['server_id'] && isset($allowed[$d['server_id']]) ? 'group-'.$d['server_id'] : 'unassigned') : null;
                    if ($parent === 'unassigned') {
                        $add('unassigned', 'group', 'Nincs szerver hozzárendelve');
                    }$add($id, 'databases', $d['name'] ?: $d['public_id'], $parent, ['public_id' => $d['public_id'],'data_quality' => $d['data_quality_status']]);
                    if ($d['application_id'] && isset($nodes[$d['application_id']])) {
                        $edges[] = ['id' => 'db-'.$id,'source' => $d['application_id'],'target' => $id,'type' => 'database','entity_ids' => [$id],'count' => 1,'label' => 'Adatbázis-használat'];
                    }
                }
            }
        }
        if ($view !== 'network' && ($c['integrations'] ?? true)) {
            foreach ($ints as $i) {
                $s = $i['source_application_id'];
                $t = $i['target_application_id'];
                if ($view === 'servers') {
                    $s = $apps[$s]['server_id'] ?? null;
                    $t = $apps[$t]['server_id'] ?? null;
                    if (!$s || !$t) {
                        $unprojected[] = $i['public_id'];
                        continue;
                    }
                }if (!isset($nodes[$s],$nodes[$t])) {
                    $omitted++;
                    continue;
                }$key = $view === 'servers' && ($c['aggregate'] ?? true) ? 'int-'.$s.'-'.$t : 'int-'.$i['id'];
                if (isset($edges[$key])) {
                    $edges[$key]['entity_ids'][] = $i['id'];
                    $edges[$key]['count']++;
                    $edges[$key]['label'] = $edges[$key]['count'].' integráció';
                } else {
                    $edges[$key] = ['id' => $key,'source' => $s,'target' => $t,'type' => 'integration','entity_ids' => [$i['id']],'count' => 1,'status' => $i['status'],'label' => $i['interface_type'] ?: 'Integráció'];
                }
            }
        }
        if ($view === 'network') {
            $eps = $this->a->all('SELECT * FROM connection_endpoints');
            foreach ($tables['network_connections'] as $id => $r) {
                $sides = ['source' => [],'target' => []];
                foreach ($eps as $e) {
                    if ($e['connection_id'] === $id) {
                        $nid = $e['server_id'];
                        if ($nid) {
                            if (!isset($nodes[$nid])) {
                                continue;
                            }
                        } else {
                            $nid = 'ep-'.$e['id'];
                            $add($nid, 'endpoint', $e['value'] ?: ($e['endpoint_kind'] === 'any' ? 'Bármely (explicit)' : $e['endpoint_kind']), $ensureZone($e['zone_id']));
                        }$sides[$e['side']][] = $nid;
                    }
                }foreach ($sides['source'] as $s) {
                    foreach ($sides['target'] as $t) {
                        $edges[] = ['id' => 'net-'.$id.'-'.$s.'-'.$t,'source' => $s,'target' => $t,'type' => 'network','entity_ids' => [$id],'count' => 1,'action' => $r['action'],'status' => $r['status'],'label' => ($r['action'] === 'allow' ? 'Rögzített engedély' : ($r['action'] === 'deny' ? 'Rögzített tiltás' : 'Nem eldönthető')).' · '.$r['status']];
                    }
                }
            }if (!$tables['network_connections']) {
                $warnings[] = 'Nincs rögzített hálózati szabály. Ez nem jelent tiltott vagy elérhetetlen hálózatot.';
            }
        }
        if (!($c['isolated'] ?? true)) {
            $used = [];
            foreach ($edges as $e) {
                $used[$e['source']] = true;
                $used[$e['target']] = true;
            }foreach ($nodes as $id => $n) {
                if (!in_array($n['entity_type'], ['zone','group']) && !isset($used[$id])) {
                    unset($nodes[$id]);
                }
            }
        }
        foreach ($nodes as $id => $n) {
            if (in_array($n['entity_type'], ['zone','group']) && !array_filter($nodes, fn ($x) => ($x['parent'] ?? null) === $id)) {
                unset($nodes[$id]);
            }
        }
        $business = count(array_filter($nodes, fn ($n) => !in_array($n['entity_type'], ['zone','group'])));
        $edgeCount = count($edges);
        if ($business > 500 || $edgeCount > 2000) {
            throw new ApiError(422, "A gráf túl nagy ($business objektum, $edgeCount él). Szűkítsd a szűrőket.");
        }if ($business > 200 || $edgeCount > 500) {
            $warnings[] = 'Nagy gráf: szűkítés vagy összevonás ajánlott.';
        }
        return ['nodes' => array_values($nodes),'edges' => array_values($edges),'meta' => ['revision' => $this->a->revision(),'counts' => ['nodes' => $business,'edges' => $edgeCount],'truncated' => false,'omitted' => $omitted,'unprojected' => $unprojected,'warnings' => $warnings,'notice' => 'Nyilvántartott kapcsolatok; nem élő elérhetőségi mérés']];
    }
}
