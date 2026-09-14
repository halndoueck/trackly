import { TrackForm } from "@/components/TrackForm";
import { DemoLauncher } from "@/components/DemoLauncher";

export default function HomePage() {
  return (
    <main className="home shell">
      <div className="home-hero">
        <h1 className="brand">Trackly</h1>
        <p className="home-lede">
          One clear journey for every package — FedEx, UPS, DHL, and beyond —
          updated live as carrier webhooks land.
        </p>
      </div>
      <div className="home-panel">
        <TrackForm />
        <DemoLauncher />
        <p className="home-footnote">
          Demo mode simulates signed webhooks end-to-end. Point AfterShip or
          EasyPost at <code>/api/webhooks/aftership</code> or{" "}
          <code>/api/webhooks/easypost</code> for production carriers.
        </p>
      </div>
    </main>
  );
}
