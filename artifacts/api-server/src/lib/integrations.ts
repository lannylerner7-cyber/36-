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
      configured: Boolean(process.env.ROUTING_LOOKUP_BASE_URL),
      provider: "Routing directory adapter",
      message: process.env.ROUTING_LOOKUP_BASE_URL
        ? "Routing directory adapter is configured."
        : "Local ABA validation is available; bank metadata provider is not configured.",
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

  return LookupRoutingNumberResponse.parse({
    routingNumber: input.routingNumber,
    valid,
    bankName: null,
    bankAddress: null,
    providerConfigured: Boolean(process.env.ROUTING_LOOKUP_BASE_URL),
    message: valid
      ? process.env.ROUTING_LOOKUP_BASE_URL
        ? "Routing number passed local validation; provider lookup is next."
        : "Routing number passed local ABA validation. Bank metadata provider is not configured."
      : "Routing number failed ABA checksum validation.",
  });
}