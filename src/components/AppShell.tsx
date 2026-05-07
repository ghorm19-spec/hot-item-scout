interface Props { children: React.ReactNode; }
export function AppShell({ children }: Props) {
  return (
    <div className="min-h-screen pb-24 max-w-md mx-auto px-4 pt-[env(safe-area-inset-top)]">
      {children}
    </div>
  );
}
