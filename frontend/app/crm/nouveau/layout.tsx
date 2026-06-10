import { NouveauGate } from "@/components/crm/NouveauGate";

export default function NouveauLayout({ children }: { children: React.ReactNode }) {
  return <NouveauGate>{children}</NouveauGate>;
}
