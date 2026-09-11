export default function FitnessPlanLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="fitness-plan-contrast">
      <style>{`
        .fitness-plan-contrast .page-canvas > .mt-6.flex.gap-2.overflow-x-auto.pb-2 {
          margin-top: 1.5rem;
          padding: 0.6rem;
          border: 1px solid rgba(148, 163, 184, 0.45);
          border-radius: 1rem;
          background: rgba(255, 255, 255, 0.96);
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.12);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          scrollbar-width: thin;
        }

        .fitness-plan-contrast .page-canvas > .mt-6.flex.gap-2.overflow-x-auto.pb-2 > button {
          flex: 0 0 auto;
          min-height: 2.5rem;
          border: 1px solid #cbd5e1 !important;
          background: #f1f5f9 !important;
          color: #1e293b !important;
          font-weight: 650;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
        }

        .fitness-plan-contrast .page-canvas > .mt-6.flex.gap-2.overflow-x-auto.pb-2 > button:hover {
          background: #e2e8f0 !important;
          color: #0f172a !important;
          border-color: #94a3b8 !important;
        }

        .fitness-plan-contrast .page-canvas > .mt-6.flex.gap-2.overflow-x-auto.pb-2 > button.bg-accent {
          background: #0f766e !important;
          color: #ffffff !important;
          border-color: #0f766e !important;
          box-shadow: 0 4px 12px rgba(15, 118, 110, 0.28);
        }

        .fitness-plan-contrast [class*="bg-amber-50"] {
          background: #fffbeb !important;
          border-color: #f59e0b !important;
          box-shadow: 0 6px 18px rgba(120, 53, 15, 0.08);
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }

        .fitness-plan-contrast [class*="bg-amber-50"] p {
          color: #451a03 !important;
          font-weight: 500;
          line-height: 1.65;
          text-shadow: none !important;
        }

        .dark .fitness-plan-contrast .page-canvas > .mt-6.flex.gap-2.overflow-x-auto.pb-2 {
          background: rgba(15, 23, 42, 0.97);
          border-color: rgba(100, 116, 139, 0.7);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.28);
        }

        .dark .fitness-plan-contrast .page-canvas > .mt-6.flex.gap-2.overflow-x-auto.pb-2 > button {
          background: #1e293b !important;
          color: #f8fafc !important;
          border-color: #475569 !important;
        }

        .dark .fitness-plan-contrast .page-canvas > .mt-6.flex.gap-2.overflow-x-auto.pb-2 > button:hover {
          background: #334155 !important;
          color: #ffffff !important;
          border-color: #64748b !important;
        }

        .dark .fitness-plan-contrast .page-canvas > .mt-6.flex.gap-2.overflow-x-auto.pb-2 > button.bg-accent {
          background: #0d9488 !important;
          color: #ffffff !important;
          border-color: #2dd4bf !important;
        }

        .dark .fitness-plan-contrast [class*="bg-amber-50"] {
          background: #451a03 !important;
          border-color: #d97706 !important;
        }

        .dark .fitness-plan-contrast [class*="bg-amber-50"] p {
          color: #fef3c7 !important;
        }

        @media (max-width: 767px) {
          .fitness-plan-contrast .page-canvas > .mt-6.flex.gap-2.overflow-x-auto.pb-2 {
            position: sticky;
            top: 4.25rem;
            z-index: 20;
            margin-left: -0.25rem;
            margin-right: -0.25rem;
            border-radius: 0.875rem;
          }

          .fitness-plan-contrast .page-canvas > .mt-6.flex.gap-2.overflow-x-auto.pb-2 > button {
            padding-left: 0.9rem;
            padding-right: 0.9rem;
          }
        }
      `}</style>
      {children}
    </div>
  );
}
