import {
  AutocompletePlaceBody,
  AutocompletePlaceResponse,
  LookupRoutingNumberResponse,
} from "@workspace/api-zod";
import type {
  PlaceAutocompleteInput,
  PlaceAutocompleteResponse,
  IntegrationStatus,
  RoutingLookupInput,
  RoutingLookupResponse,
} from "@workspace/api-zod";
import {
  getRoutingDirectoryStatus,
  lookupRoutingDirectory,
} from "./routing-directory";

type GoogleAutocompleteResponse = {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string;
      text?: { text?: string };
    };
  }>;
};

export function isValidRoutingNumber(routingNumber: string): boolean {
  if (!/^\d{9}$/.test(routingNumber)) {
    return false;
  }

  const weights = [3, 7, 1, 3, 7, 1, 3, 7, 1];
  const checksum = routingNumber
    .split("")
    .reduce((total, digit, index) => total + Number(digit) * weights[index], 0);

  return checksum % 10 === 0;
}

function getWebsiteHostname(website: string): string | null {
  try {
    return new URL(website.startsWith("http") ? website : `https://${website}`).hostname;
  } catch {
    return null;
  }
}

export function getIntegrationStatus(): IntegrationStatus {
  return {
    places: {
      configured: Boolean(process.env.GOOGLE_MAPS_API_KEY),
      provider: "Google Maps Platform",
      message: process.env.GOOGLE_MAPS_API_KEY
        ? "Address suggestions are ready."
        : "Add GOOGLE_MAPS_API_KEY to enable address suggestions.",
    },
    routing: {
      configured: getRoutingDirectoryStatus().configured,
      provider: "Local FedACH/FedWire directory",
      message: getRoutingDirectoryStatus().configured
        ? `Local routing directory loaded with ${getRoutingDirectoryStatus().recordCount.toLocaleString()} records.`
        : "Local ABA validation is available; install a current license-authorized routing directory file for bank metadata.",
    },
    pdf: {
      configured: false,
      provider: "Server PDF renderer",
      message: "PDF export boundary is ready; server renderer configuration is pending.",
    },
  };
}

export async function autocompletePlace(
  input: PlaceAutocompleteInput,
): Promise<PlaceAutocompleteResponse> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY is not configured");
  }

  const response = await fetch(
    "https://places.googleapis.com/v1/places:autocomplete",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text",
      },
      body: JSON.stringify({
        input: input.input,
        includedPrimaryTypes: ["street_address", "premise", "establishment"],
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Google Places request failed with ${response.status}`);
  }

  const payload = (await response.json()) as GoogleAutocompleteResponse;
  return AutocompletePlaceResponse.parse({
    suggestions: (payload.suggestions ?? [])
      .map((suggestion) => suggestion.placePrediction)
      .filter(
        (prediction): prediction is NonNullable<typeof prediction> =>
          Boolean(prediction?.placeId && prediction.text?.text),
      )
      .map((prediction) => ({
        id: prediction.placeId!,
        description: prediction.text!.text!,
      })),
  });
}

export function lookupRoutingNumber(
  input: RoutingLookupInput,
): RoutingLookupResponse {
  const valid = isValidRoutingNumber(input.routingNumber);
  const directory = getRoutingDirectoryStatus();
  const record = valid ? lookupRoutingDirectory(input.routingNumber) : null;
  const websiteHostname = record?.website ? getWebsiteHostname(record.website) : null;
  const logoUrl = record?.logoUrl
    ?? (websiteHostname && process.env.ROUTING_LOGO_GOOGLE_FAVICON === "true"
      ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(websiteHostname)}&sz=128`
      : null);
  const logoSource = record?.logoUrl
    ? "directory"
    : logoUrl
      ? "google-favicon-ui-fallback"
      : null;

  return LookupRoutingNumberResponse.parse({
    routingNumber: input.routingNumber,
    valid,
    lookupStatus: !valid ? "invalid_checksum" : record ? "found" : "not_found",
    bankName: record?.bankName ?? null,
    bankAddress: record?.bankAddress ?? null,
    bankWebsite: record?.website ?? null,
    bankLogoUrl: logoUrl,
    bankLogoSource: logoSource,
    rails: record?.rails ?? [],
    source: record?.source ?? null,
    lastUpdated: record?.lastUpdated ?? directory.lastUpdated,
    providerConfigured: directory.configured,
    message: !valid
      ? "Routing number failed ABA checksum validation."
      : record
        ? `Routing number matched ${record.bankName} in the local directory.`
        : directory.configured
          ? "Routing number passed ABA validation but was not found in the loaded directory."
          : "Routing number passed local ABA validation. Bank metadata directory is not configured.",
  });
}