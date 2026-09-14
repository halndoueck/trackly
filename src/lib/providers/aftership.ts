/**
 * Optional AfterShip tracker registration.
 * When AFTERSHIP_API_KEY is unset, Trackly stays in demo/local mode.
 */
export async function registerAfterShipTracker(input: {
  trackingNumber: string;
  carrierSlug?: string;
}): Promise<{ id: string | null; ok: boolean; error?: string }> {
  const apiKey = process.env.AFTERSHIP_API_KEY;
  if (!apiKey) {
    return { id: null, ok: false, error: "AFTERSHIP_API_KEY not configured" };
  }

  const body: Record<string, unknown> = {
    tracking: {
      tracking_number: input.trackingNumber,
    },
  };
  if (input.carrierSlug && input.carrierSlug !== "unknown") {
    (body.tracking as Record<string, unknown>).slug = input.carrierSlug.replace(
      /_/g,
      "-",
    );
  }

  try {
    const res = await fetch("https://api.aftership.com/tracking/2024-01/trackings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "as-api-key": apiKey,
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as {
      data?: { tracking?: { id?: string } };
      meta?: { message?: string };
    };
    if (!res.ok) {
      return {
        id: null,
        ok: false,
        error: json.meta?.message ?? `AfterShip HTTP ${res.status}`,
      };
    }
    return { id: json.data?.tracking?.id ?? null, ok: true };
  } catch (err) {
    return {
      id: null,
      ok: false,
      error: err instanceof Error ? err.message : "AfterShip request failed",
    };
  }
}
