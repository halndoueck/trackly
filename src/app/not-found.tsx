import Link from "next/link";

export default function NotFound() {
  return (
    <main className="home shell">
      <div className="home-hero">
        <h1 className="brand">Trackly</h1>
        <p className="home-lede">
          We could not find that tracking number. It may not be registered yet,
          or the number may be mistyped.
        </p>
        <Link href="/" className="btn-ghost">
          Track a package
        </Link>
      </div>
    </main>
  );
}
