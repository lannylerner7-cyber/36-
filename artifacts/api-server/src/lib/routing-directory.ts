import fs from "node:fs";
import path from "node:path";

export type RoutingDirectoryRecord = {
  routingNumber: string;
  bankName: string;
  bankAddress: string | null;
  website: string | null;
  logoUrl: string | null;
  rails: string[];
  source: string;
  lastUpdated: string | null;
};

export type RoutingDirectoryStatus = {
  configured: boolean;
  recordCount: number;
  source: string | null;
  lastUpdated: string | null;
};

type DirectoryPayload = Record<string, unknown> | unknown[];

type RawDirectoryRecord = Record<string, unknown>;

type RoutingDirectory = {
  records: Map<string, RoutingDirectoryRecord>;
  status: RoutingDirectoryStatus;
};

let cachedDirectory: RoutingDirectory | undefined;

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function joinAddress(...parts: Array<unknown>): string | null {
  const values = parts.map(text).filter((value): value is string => Boolean(value));
  return values.length > 0 ? values.join(", ") : null;
}

function extractRecords(payload: DirectoryPayload): RawDirectoryRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is RawDirectoryRecord => Boolean(item && typeof item === "object"));
  }

  const directKeys = ["records", "entries", "institutions", "banks"];
  for (const key of directKeys) {
    const value = payload[key];
    if (Array.isArray(value)) {
      return value.filter((item): item is RawDirectoryRecord => Boolean(item && typeof item === "object"));
    }
  }

  const nestedKeys = ["fedACHParticipants", "fedwireParticipants"];
  for (const key of nestedKeys) {
    const nested = payload[key];
    if (Array.isArray(nested)) {
      return nested.filter((item): item is RawDirectoryRecord => Boolean(item && typeof item === "object"));
    }
    if (nested && typeof nested === "object") {
      const records = (nested as Record<string, unknown>)[key];
      if (Array.isArray(records)) {
        return records.filter((item): item is RawDirectoryRecord => Boolean(item && typeof item === "object"));
      }
    }
  }

  return [];
}

function normalizeRecord(raw: RawDirectoryRecord, source: string): RoutingDirectoryRecord | null {
  const routingNumber = text(raw.routingNumber);
  const bankName = text(raw.bankName) ?? text(raw.customerName) ?? text(raw.name);
  if (!routingNumber || !/^\d{9}$/.test(routingNumber) || !bankName) return null;

  const bankAddress = joinAddress(
    raw.bankAddress,
    raw.customerAddress,
    raw.address,
    raw.customerCity,
    raw.city,
    raw.customerState,
    raw.state,
    raw.customerZip,
    raw.zip,
  );
  const website = text(raw.website) ?? text(raw.domain);
  const logoUrl = text(raw.logoUrl);
  const rawRails = Array.isArray(raw.rails)
    ? raw.rails.filter((rail): rail is string => typeof rail === "string")
    : [];
  const inferredRail = /fpddir|fedwire/i.test(source) ? "fedwire" : "fedach";

  return {
    routingNumber,
    bankName,
    bankAddress,
    website,
    logoUrl,
    rails: rawRails.length > 0 ? rawRails : [inferredRail],
    source,
    lastUpdated: text(raw.lastUpdated) ?? text(raw.changeDate),
  };
}

function parseFedAchLine(line: string, source: string): RoutingDirectoryRecord | null {
  if (line.length < 149 || !/^\d{9}/.test(line)) return null;

  const field = (start: number, length: number) => line.slice(start, start + length).trim();
  const routingNumber = field(0, 9);
  const bankName = field(35, 36);
  if (!bankName) return null;

  return {
    routingNumber,
    bankName,
    bankAddress: joinAddress(field(71, 36), field(107, 20), field(127, 2), field(129, 5)),
    website: null,
    logoUrl: null,
    rails: ["fedach"],
    source,
    lastUpdated: field(20, 6) || null,
  };
}

function readFileRecords(filePath: string): RoutingDirectoryRecord[] {
  const source = path.basename(filePath);
  const content = fs.readFileSync(filePath, "utf8");

  if (path.extname(filePath).toLowerCase() === ".json") {
    const payload = JSON.parse(content) as DirectoryPayload;
    return extractRecords(payload)
      .map((record) => normalizeRecord(record, source))
      .filter((record): record is RoutingDirectoryRecord => Boolean(record));
  }

  return content
    .split(/\r?\n/)
    .map((line) => parseFedAchLine(line, source))
    .filter((record): record is RoutingDirectoryRecord => Boolean(record));
}

function loadDirectory(): RoutingDirectory {
  const configuredPath = text(process.env.ROUTING_DIRECTORY_PATH);
  if (!configuredPath || !fs.existsSync(configuredPath)) {
    return {
      records: new Map(),
      status: {
        configured: false,
        recordCount: 0,
        source: null,
        lastUpdated: null,
      },
    };
  }

  const files = fs.statSync(configuredPath).isDirectory()
    ? fs.readdirSync(configuredPath)
        .filter((file) => /\.(json|txt|dat)$/i.test(file))
        .map((file) => path.join(configuredPath, file))
    : [configuredPath];
  const records = new Map<string, RoutingDirectoryRecord>();

  for (const filePath of files) {
    try {
      for (const record of readFileRecords(filePath)) {
        const existing = records.get(record.routingNumber);
        records.set(record.routingNumber, existing
          ? {
              ...existing,
              bankAddress: existing.bankAddress ?? record.bankAddress,
              website: existing.website ?? record.website,
              logoUrl: existing.logoUrl ?? record.logoUrl,
              rails: Array.from(new Set([...existing.rails, ...record.rails])),
              lastUpdated: existing.lastUpdated ?? record.lastUpdated,
              source: `${existing.source}, ${record.source}`,
            }
          : record);
      }
    } catch {
      // A malformed optional file must not disable checksum validation.
    }
  }

  const lastUpdated = text(process.env.ROUTING_DIRECTORY_EFFECTIVE_DATE)
    ?? Array.from(records.values()).map((record) => record.lastUpdated).find(Boolean)
    ?? null;

  return {
    records,
    status: {
      configured: records.size > 0,
      recordCount: records.size,
      source: records.size > 0 ? configuredPath : null,
      lastUpdated,
    },
  };
}

export function getRoutingDirectory(): RoutingDirectory {
  cachedDirectory ??= loadDirectory();
  return cachedDirectory;
}

export function reloadRoutingDirectory(): RoutingDirectoryStatus {
  cachedDirectory = loadDirectory();
  return cachedDirectory.status;
}

export function lookupRoutingDirectory(routingNumber: string): RoutingDirectoryRecord | null {
  return getRoutingDirectory().records.get(routingNumber) ?? null;
}

export function getRoutingDirectoryStatus(): RoutingDirectoryStatus {
  return getRoutingDirectory().status;
}