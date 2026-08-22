export default function OfflinePage() {
  return (
    <div className="min-h-screen grid place-items-center p-6 atmosphere">
      <div className="text-center max-w-sm">
        <h1 className="font-[family-name:var(--font-display)] text-3xl">
          You&apos;re offline
        </h1>
        <p className="mt-2 text-muted text-sm">
          Flowdesk will reconnect when you&apos;re back online. Cached pages may
          still work.
        </p>
      </div>
    </div>
  );
}
