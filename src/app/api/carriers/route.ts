import { NextResponse } from "next/server";
import { CARRIERS } from "@/lib/carrier-detect";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    carriers: CARRIERS.map((c) => ({
      slug: c.slug,
      name: c.name,
    })),
    providers: [
      {
        id: "demo",
        name: "Built-in demo simulator",
        webhooks: ["/api/webhooks/demo"],
      },
      {
        id: "aftership",
        name: "AfterShip",
        webhooks: ["/api/webhooks/aftership"],
        env: ["AFTERSHIP_API_KEY", "AFTERSHIP_WEBHOOK_SECRET"],
      },
      {
        id: "easypost",
        name: "EasyPost",
        webhooks: ["/api/webhooks/easypost"],
        env: ["EASYPOST_API_KEY", "EASYPOST_WEBHOOK_SECRET"],
      },
    ],
  });
}
