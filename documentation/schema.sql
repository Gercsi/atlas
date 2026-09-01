-- Atlas CMDB schema snapshot; no customer records
SET FOREIGN_KEY_CHECKS=0;
CREATE TABLE `application_business_areas` (
  `application_id` char(26) NOT NULL,
  `reference_id` char(26) NOT NULL,
  PRIMARY KEY (`application_id`,`reference_id`),
  KEY `reference_id` (`reference_id`),
  CONSTRAINT `application_business_areas_ibfk_1` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`),
  CONSTRAINT `application_business_areas_ibfk_2` FOREIGN KEY (`reference_id`) REFERENCES `reference_data` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `applications` (
  `id` char(26) NOT NULL,
  `public_id` varchar(128) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `created_by` char(26) DEFAULT NULL,
  `updated_by` char(26) DEFAULT NULL,
  `lock_version` int(11) NOT NULL DEFAULT 1,
  `archived_at` datetime(6) DEFAULT NULL,
  `data_quality_status` varchar(30) NOT NULL DEFAULT 'complete',
  `quality_warnings` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`quality_warnings`)),
  `raw_source` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`raw_source`)),
  `name` varchar(255) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `server_id` char(26) DEFAULT NULL,
  `environment` varchar(255) DEFAULT NULL,
  `criticality` varchar(255) DEFAULT NULL,
  `vendor` varchar(255) DEFAULT NULL,
  `version` varchar(255) DEFAULT NULL,
  `sla` varchar(255) DEFAULT NULL,
  `lifecycle_status` varchar(255) DEFAULT NULL,
  `go_live_date` date DEFAULT NULL,
  `end_of_support_date` date DEFAULT NULL,
  `hosting_classification` varchar(255) DEFAULT NULL,
  `network_zone_id` char(26) DEFAULT NULL,
  `legacy_business_owner_text` varchar(255) DEFAULT NULL,
  `legacy_technical_owner_text` varchar(255) DEFAULT NULL,
  `legacy_business_areas_text` text DEFAULT NULL,
  `notes` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `public_id` (`public_id`),
  KEY `fk_applications_server_id` (`server_id`),
  KEY `fk_applications_network_zone_id` (`network_zone_id`),
  KEY `idx_applications_name` (`name`),
  KEY `idx_applications_environment` (`environment`),
  KEY `idx_applications_criticality` (`criticality`),
  CONSTRAINT `fk_applications_network_zone_id` FOREIGN KEY (`network_zone_id`) REFERENCES `network_zones` (`id`),
  CONSTRAINT `fk_applications_server_id` FOREIGN KEY (`server_id`) REFERENCES `servers` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `applications_contacts` (
  `id` char(26) NOT NULL,
  `target_id` char(26) NOT NULL,
  `contact_id` char(26) NOT NULL,
  `role_code` varchar(40) NOT NULL,
  `role_description` text DEFAULT NULL,
  `is_primary` tinyint(1) NOT NULL DEFAULT 0,
  `notes` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `target_id` (`target_id`,`contact_id`,`role_code`),
  KEY `contact_id` (`contact_id`),
  CONSTRAINT `applications_contacts_ibfk_1` FOREIGN KEY (`target_id`) REFERENCES `applications` (`id`),
  CONSTRAINT `applications_contacts_ibfk_2` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `audit_log` (
  `id` char(26) NOT NULL,
  `user_id` char(26) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `action` varchar(40) NOT NULL,
  `entity` varchar(40) NOT NULL,
  `entity_id` char(26) DEFAULT NULL,
  `diff` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`diff`)),
  PRIMARY KEY (`id`),
  KEY `entity` (`entity`,`entity_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `connection_endpoints` (
  `id` char(26) NOT NULL,
  `connection_id` char(26) NOT NULL,
  `side` varchar(10) NOT NULL,
  `endpoint_kind` varchar(30) NOT NULL,
  `server_id` char(26) DEFAULT NULL,
  `server_address_id` char(26) DEFAULT NULL,
  `zone_id` char(26) DEFAULT NULL,
  `value` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `connection_id` (`connection_id`),
  KEY `server_id` (`server_id`),
  KEY `server_address_id` (`server_address_id`),
  KEY `zone_id` (`zone_id`),
  CONSTRAINT `connection_endpoints_ibfk_1` FOREIGN KEY (`connection_id`) REFERENCES `network_connections` (`id`),
  CONSTRAINT `connection_endpoints_ibfk_2` FOREIGN KEY (`server_id`) REFERENCES `servers` (`id`),
  CONSTRAINT `connection_endpoints_ibfk_3` FOREIGN KEY (`server_address_id`) REFERENCES `server_addresses` (`id`),
  CONSTRAINT `connection_endpoints_ibfk_4` FOREIGN KEY (`zone_id`) REFERENCES `network_zones` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `connection_services` (
  `id` char(26) NOT NULL,
  `connection_id` char(26) NOT NULL,
  `side` varchar(20) NOT NULL,
  `port_from` int(11) DEFAULT NULL,
  `port_to` int(11) DEFAULT NULL,
  `icmp_type` int(11) DEFAULT NULL,
  `icmp_code` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `connection_id` (`connection_id`),
  CONSTRAINT `connection_services_ibfk_1` FOREIGN KEY (`connection_id`) REFERENCES `network_connections` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `contacts` (
  `id` char(26) NOT NULL,
  `public_id` varchar(128) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `created_by` char(26) DEFAULT NULL,
  `updated_by` char(26) DEFAULT NULL,
  `lock_version` int(11) NOT NULL DEFAULT 1,
  `archived_at` datetime(6) DEFAULT NULL,
  `data_quality_status` varchar(30) NOT NULL DEFAULT 'complete',
  `quality_warnings` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`quality_warnings`)),
  `raw_source` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`raw_source`)),
  `name` varchar(255) DEFAULT NULL,
  `contact_type` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(255) DEFAULT NULL,
  `organization` varchar(255) DEFAULT NULL,
  `job_title` varchar(255) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `public_id` (`public_id`),
  KEY `idx_contacts_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `databases` (
  `id` char(26) NOT NULL,
  `public_id` varchar(128) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `created_by` char(26) DEFAULT NULL,
  `updated_by` char(26) DEFAULT NULL,
  `lock_version` int(11) NOT NULL DEFAULT 1,
  `archived_at` datetime(6) DEFAULT NULL,
  `data_quality_status` varchar(30) NOT NULL DEFAULT 'complete',
  `quality_warnings` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`quality_warnings`)),
  `raw_source` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`raw_source`)),
  `name` varchar(255) DEFAULT NULL,
  `engine` varchar(255) DEFAULT NULL,
  `version` varchar(255) DEFAULT NULL,
  `server_id` char(26) DEFAULT NULL,
  `application_id` char(26) DEFAULT NULL,
  `backup_enabled` tinyint(1) DEFAULT NULL,
  `replication_enabled` tinyint(1) DEFAULT NULL,
  `backup_details` text DEFAULT NULL,
  `replication_details` text DEFAULT NULL,
  `legacy_owner_text` varchar(255) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `public_id` (`public_id`),
  UNIQUE KEY `db_application_unique` (`application_id`),
  KEY `fk_databases_server_id` (`server_id`),
  KEY `idx_databases_name` (`name`),
  CONSTRAINT `fk_databases_application_id` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`),
  CONSTRAINT `fk_databases_server_id` FOREIGN KEY (`server_id`) REFERENCES `servers` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `databases_contacts` (
  `id` char(26) NOT NULL,
  `target_id` char(26) NOT NULL,
  `contact_id` char(26) NOT NULL,
  `role_code` varchar(40) NOT NULL,
  `role_description` text DEFAULT NULL,
  `is_primary` tinyint(1) NOT NULL DEFAULT 0,
  `notes` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `target_id` (`target_id`,`contact_id`,`role_code`),
  KEY `contact_id` (`contact_id`),
  CONSTRAINT `databases_contacts_ibfk_1` FOREIGN KEY (`target_id`) REFERENCES `databases` (`id`),
  CONSTRAINT `databases_contacts_ibfk_2` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `diagram_views` (
  `id` char(26) NOT NULL,
  `owner_id` char(26) NOT NULL,
  `name` varchar(255) NOT NULL,
  `visibility` varchar(20) NOT NULL,
  `config` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`config`)),
  `lock_version` int(11) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `owner_id` (`owner_id`),
  CONSTRAINT `diagram_views_ibfk_1` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `import_rows` (
  `id` char(26) NOT NULL,
  `batch_id` char(26) NOT NULL,
  `entity` varchar(40) NOT NULL,
  `public_id` varchar(128) NOT NULL,
  `sheet` varchar(100) DEFAULT NULL,
  `row_number` int(11) DEFAULT NULL,
  `disposition` varchar(30) DEFAULT NULL,
  `raw_values` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`raw_values`)),
  PRIMARY KEY (`id`),
  KEY `batch_id` (`batch_id`),
  CONSTRAINT `import_rows_ibfk_1` FOREIGN KEY (`batch_id`) REFERENCES `imports` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `imports` (
  `id` char(26) NOT NULL,
  `file_hash` char(64) NOT NULL,
  `profile` varchar(60) NOT NULL,
  `status` varchar(30) NOT NULL,
  `revision` bigint(20) NOT NULL,
  `preview` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`preview`)),
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `integration_connections` (
  `integration_id` char(26) NOT NULL,
  `connection_id` char(26) NOT NULL,
  `mapping_notes` text DEFAULT NULL,
  `verified_by` char(26) DEFAULT NULL,
  `verified_at` datetime DEFAULT NULL,
  PRIMARY KEY (`integration_id`,`connection_id`),
  KEY `connection_id` (`connection_id`),
  CONSTRAINT `integration_connections_ibfk_1` FOREIGN KEY (`integration_id`) REFERENCES `integrations` (`id`),
  CONSTRAINT `integration_connections_ibfk_2` FOREIGN KEY (`connection_id`) REFERENCES `network_connections` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `integrations` (
  `id` char(26) NOT NULL,
  `public_id` varchar(128) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `created_by` char(26) DEFAULT NULL,
  `updated_by` char(26) DEFAULT NULL,
  `lock_version` int(11) NOT NULL DEFAULT 1,
  `archived_at` datetime(6) DEFAULT NULL,
  `data_quality_status` varchar(30) NOT NULL DEFAULT 'complete',
  `quality_warnings` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`quality_warnings`)),
  `raw_source` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`raw_source`)),
  `source_application_id` char(26) DEFAULT NULL,
  `target_application_id` char(26) DEFAULT NULL,
  `interface_type` varchar(255) DEFAULT NULL,
  `protocol` varchar(255) DEFAULT NULL,
  `authentication` varchar(255) DEFAULT NULL,
  `frequency` varchar(255) DEFAULT NULL,
  `middleware` varchar(255) DEFAULT NULL,
  `data_owner_application_id` char(26) DEFAULT NULL,
  `legacy_data_owner_text` varchar(255) DEFAULT NULL,
  `criticality` varchar(255) DEFAULT NULL,
  `status` varchar(255) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `public_id` (`public_id`),
  KEY `fk_integrations_source_application_id` (`source_application_id`),
  KEY `fk_integrations_target_application_id` (`target_application_id`),
  KEY `fk_integrations_data_owner_application_id` (`data_owner_application_id`),
  KEY `idx_integrations_status` (`status`),
  KEY `idx_integrations_criticality` (`criticality`),
  CONSTRAINT `fk_integrations_data_owner_application_id` FOREIGN KEY (`data_owner_application_id`) REFERENCES `applications` (`id`),
  CONSTRAINT `fk_integrations_source_application_id` FOREIGN KEY (`source_application_id`) REFERENCES `applications` (`id`),
  CONSTRAINT `fk_integrations_target_application_id` FOREIGN KEY (`target_application_id`) REFERENCES `applications` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `jobs` (
  `id` char(26) NOT NULL,
  `user_id` char(26) NOT NULL,
  `status` varchar(20) NOT NULL,
  `format` varchar(10) NOT NULL,
  `path` text DEFAULT NULL,
  `options` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`options`)),
  `error` text DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `jobs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `login_attempts` (
  `bucket` char(64) NOT NULL,
  `attempts` int(11) NOT NULL,
  `reset_at` bigint(20) NOT NULL,
  PRIMARY KEY (`bucket`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `network_boundaries` (
  `id` char(26) NOT NULL,
  `name` varchar(255) NOT NULL,
  `zone_a_id` char(26) NOT NULL,
  `zone_b_id` char(26) NOT NULL,
  `boundary_type` varchar(20) NOT NULL,
  `notes` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `zone_a_id` (`zone_a_id`),
  KEY `zone_b_id` (`zone_b_id`),
  CONSTRAINT `network_boundaries_ibfk_1` FOREIGN KEY (`zone_a_id`) REFERENCES `network_zones` (`id`),
  CONSTRAINT `network_boundaries_ibfk_2` FOREIGN KEY (`zone_b_id`) REFERENCES `network_zones` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `network_connections` (
  `id` char(26) NOT NULL,
  `public_id` varchar(128) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `created_by` char(26) DEFAULT NULL,
  `updated_by` char(26) DEFAULT NULL,
  `lock_version` int(11) NOT NULL DEFAULT 1,
  `archived_at` datetime(6) DEFAULT NULL,
  `data_quality_status` varchar(30) NOT NULL DEFAULT 'complete',
  `quality_warnings` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`quality_warnings`)),
  `raw_source` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`raw_source`)),
  `name` varchar(255) DEFAULT NULL,
  `connection_type` varchar(255) DEFAULT NULL,
  `action` varchar(255) DEFAULT NULL,
  `status` varchar(255) DEFAULT NULL,
  `transport_protocol` varchar(255) DEFAULT NULL,
  `source_ports_mode` varchar(255) DEFAULT NULL,
  `destination_ports_mode` varchar(255) DEFAULT NULL,
  `firewall_name` varchar(255) DEFAULT NULL,
  `external_rule_id` varchar(255) DEFAULT NULL,
  `priority` int(11) DEFAULT NULL,
  `vpn_tunnel_name` varchar(255) DEFAULT NULL,
  `nat_description` text DEFAULT NULL,
  `valid_from` date DEFAULT NULL,
  `valid_to` date DEFAULT NULL,
  `last_reviewed_at` date DEFAULT NULL,
  `owner_contact_id` char(26) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `public_id` (`public_id`),
  KEY `fk_network_connections_owner_contact_id` (`owner_contact_id`),
  KEY `idx_network_connections_name` (`name`),
  KEY `idx_network_connections_status` (`status`),
  CONSTRAINT `fk_network_connections_owner_contact_id` FOREIGN KEY (`owner_contact_id`) REFERENCES `contacts` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `network_zones` (
  `id` char(26) NOT NULL,
  `name` varchar(255) NOT NULL,
  `scope` varchar(20) NOT NULL,
  `parent_zone_id` char(26) DEFAULT NULL,
  `color` varchar(20) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `parent_zone_id` (`parent_zone_id`),
  CONSTRAINT `network_zones_ibfk_1` FOREIGN KEY (`parent_zone_id`) REFERENCES `network_zones` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `reference_data` (
  `id` char(26) NOT NULL,
  `category` varchar(60) NOT NULL,
  `code` varchar(255) NOT NULL,
  `label` varchar(255) NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `category` (`category`,`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `revision` (
  `id` int(11) NOT NULL,
  `value` bigint(20) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `sequences` (
  `entity` varchar(40) NOT NULL,
  `next_value` bigint(20) NOT NULL,
  PRIMARY KEY (`entity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `server_addresses` (
  `id` char(26) NOT NULL,
  `server_id` char(26) NOT NULL,
  `address` varchar(255) NOT NULL,
  `zone_id` char(26) NOT NULL,
  `is_primary` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `server_id` (`server_id`,`zone_id`,`address`),
  KEY `zone_id` (`zone_id`),
  CONSTRAINT `server_addresses_ibfk_1` FOREIGN KEY (`server_id`) REFERENCES `servers` (`id`),
  CONSTRAINT `server_addresses_ibfk_2` FOREIGN KEY (`zone_id`) REFERENCES `network_zones` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `servers` (
  `id` char(26) NOT NULL,
  `public_id` varchar(128) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `created_by` char(26) DEFAULT NULL,
  `updated_by` char(26) DEFAULT NULL,
  `lock_version` int(11) NOT NULL DEFAULT 1,
  `archived_at` datetime(6) DEFAULT NULL,
  `data_quality_status` varchar(30) NOT NULL DEFAULT 'complete',
  `quality_warnings` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`quality_warnings`)),
  `raw_source` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`raw_source`)),
  `name` varchar(255) DEFAULT NULL,
  `dns_name` varchar(255) DEFAULT NULL,
  `hostname` varchar(255) DEFAULT NULL,
  `environment` varchar(255) DEFAULT NULL,
  `hosting_type` varchar(255) DEFAULT NULL,
  `virtualization_platform` varchar(255) DEFAULT NULL,
  `os` varchar(255) DEFAULT NULL,
  `os_version` varchar(255) DEFAULT NULL,
  `cpu` int(11) DEFAULT NULL,
  `ram_gib` decimal(18,6) DEFAULT NULL,
  `storage_gb` decimal(18,6) DEFAULT NULL,
  `datacenter` varchar(255) DEFAULT NULL,
  `primary_network_zone_id` char(26) DEFAULT NULL,
  `legacy_owner_text` varchar(255) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `public_id` (`public_id`),
  KEY `fk_servers_primary_network_zone_id` (`primary_network_zone_id`),
  KEY `idx_servers_name` (`name`),
  KEY `idx_servers_environment` (`environment`),
  CONSTRAINT `fk_servers_primary_network_zone_id` FOREIGN KEY (`primary_network_zone_id`) REFERENCES `network_zones` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `servers_contacts` (
  `id` char(26) NOT NULL,
  `target_id` char(26) NOT NULL,
  `contact_id` char(26) NOT NULL,
  `role_code` varchar(40) NOT NULL,
  `role_description` text DEFAULT NULL,
  `is_primary` tinyint(1) NOT NULL DEFAULT 0,
  `notes` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `target_id` (`target_id`,`contact_id`,`role_code`),
  KEY `contact_id` (`contact_id`),
  CONSTRAINT `servers_contacts_ibfk_1` FOREIGN KEY (`target_id`) REFERENCES `servers` (`id`),
  CONSTRAINT `servers_contacts_ibfk_2` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `users` (
  `id` char(26) NOT NULL,
  `username` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` varchar(20) NOT NULL,
  `capabilities` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`capabilities`)),
  `active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `sso_settings` (
  `id` tinyint(4) NOT NULL,
  `enabled` tinyint(1) NOT NULL DEFAULT 0,
  `provider_type` varchar(20) NOT NULL DEFAULT 'entra',
  `display_name` varchar(100) NOT NULL DEFAULT 'Microsoft Entra ID',
  `tenant_id` varchar(100) DEFAULT NULL,
  `issuer_url` varchar(500) DEFAULT NULL,
  `client_id` varchar(255) DEFAULT NULL,
  `client_secret_encrypted` text DEFAULT NULL,
  `allowed_email_domains` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`allowed_email_domains`)),
  `required_group_id` varchar(100) DEFAULT NULL,
  `auto_provision` tinyint(1) NOT NULL DEFAULT 0,
  `default_role` varchar(20) NOT NULL DEFAULT 'viewer',
  `default_capabilities` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`default_capabilities`)),
  `updated_at` datetime(6) DEFAULT NULL,
  `updated_by` char(26) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `sso_settings` (`id`,`allowed_email_domains`,`default_capabilities`) VALUES (1,'[]','[]');

CREATE TABLE `user_identities` (
  `provider_key` char(64) NOT NULL,
  `subject` varchar(255) NOT NULL,
  `user_id` char(26) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `last_login_at` datetime(6) NOT NULL,
  PRIMARY KEY (`provider_key`,`subject`),
  UNIQUE KEY `provider_user` (`provider_key`,`user_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `user_identities_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS=1;
