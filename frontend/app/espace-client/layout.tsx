// Pass-through — chaque sous-section gère son propre layout via les route groups
export default function EspaceClientRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
