export let csrf = "";
export function setCsrf(v: string) {
  csrf = v;
}
export async function api(
  path: string,
  method = "GET",
  data?: unknown,
): Promise<any> {
  const form = data instanceof FormData;
  const res = await fetch(`api.php?r=${path}`, {
    method,
    headers: {
      "X-CSRF-Token": csrf,
      ...(!form ? { "Content-Type": "application/json" } : {}),
    },
    body: data ? (form ? data : JSON.stringify(data)) : undefined,
  });
  const result = await res.json();
  if (!res.ok) {
    const error = new Error(result.message) as Error & {
      fields: any;
      status: number;
    };
    error.fields = result.field_errors || {};
    error.status = res.status;
    throw error;
  }
  return result;
}
export const labels: Record<string, string> = {
  applications: "Alkalmazások",
  servers: "Szerverek",
  databases: "Adatbázisok",
  integrations: "Integrációk",
  contacts: "Kapcsolattartók",
  network_connections: "Hálózati kapcsolatok",
  name: "Név",
  description: "Leírás",
  server_id: "Szerver",
  environment: "Környezet",
  criticality: "Kritikusság",
  vendor: "Szállító",
  version: "Verzió",
  sla: "SLA",
  lifecycle_status: "Életciklus",
  go_live_date: "Éles indulás",
  end_of_support_date: "Támogatás vége",
  hosting_classification: "Elhelyezés besorolása",
  network_zone_id: "Hálózati zóna",
  legacy_business_owner_text: "Üzleti tulajdonos · nem feloldott",
  legacy_technical_owner_text: "Technikai tulajdonos · nem feloldott",
  legacy_business_areas_text: "Üzleti területek · forrásszöveg",
  notes: "Megjegyzés",
  dns_name: "DNS-név",
  hostname: "Gépnév",
  hosting_type: "Elhelyezés típusa",
  virtualization_platform: "Virtualizáció",
  os: "Operációs rendszer",
  os_version: "OS-verzió",
  cpu: "CPU / vCPU",
  ram_gib: "RAM (GiB)",
  storage_gb: "Tárhely (GB)",
  datacenter: "Adatközpont",
  primary_network_zone_id: "Elsődleges hálózati zóna",
  legacy_owner_text: "Tulajdonos · nem feloldott",
  engine: "Adatbázismotor",
  application_id: "Alkalmazás",
  backup_enabled: "Mentés rögzítve",
  replication_enabled: "Replikáció rögzítve",
  backup_details: "Mentés részletei",
  replication_details: "Replikáció részletei",
  source_application_id: "Forrásalkalmazás",
  target_application_id: "Célalkalmazás",
  interface_type: "Interfész típusa",
  protocol: "Protokoll",
  authentication: "Hitelesítési módszer (titok nélkül)",
  frequency: "Gyakoriság",
  middleware: "Middleware",
  data_owner_application_id: "Adatgazda alkalmazás",
  legacy_data_owner_text: "Adatgazda · nem feloldott",
  status: "Állapot",
  contact_type: "Kontakt típusa",
  email: "Email",
  phone: "Telefon",
  organization: "Szervezet",
  job_title: "Munkakör",
  connection_type: "Kapcsolat típusa",
  action: "Rögzített művelet",
  transport_protocol: "Szállítási protokoll",
  source_ports_mode: "Forrásportok módja",
  destination_ports_mode: "Célportok módja",
  firewall_name: "Tűzfal neve",
  external_rule_id: "Külső szabályazonosító",
  priority: "Prioritás",
  vpn_tunnel_name: "VPN-alagút neve",
  nat_description: "NAT leírás",
  valid_from: "Érvényesség kezdete",
  valid_to: "Érvényesség vége",
  last_reviewed_at: "Utoljára ellenőrizve",
  owner_contact_id: "Tulajdonos kontakt",
  public_id: "Azonosító",
  data_quality_status: "Adatminőség",
};
export const types = [
  "applications",
  "servers",
  "databases",
  "integrations",
  "contacts",
  "network_connections",
];
export function display(v: any) {
  return v === null || v === undefined || v === ""
    ? "Nincs megadva"
    : typeof v === "boolean"
      ? v
        ? "Igen"
        : "Nem"
      : String(v);
}
