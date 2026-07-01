// Pass-through — chaque sous-section gère son propre layout
export default function EspaceAscensoristeRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
