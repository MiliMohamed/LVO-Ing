"use client";

import { PrimeReactProvider } from "primereact/api";
import "primereact/resources/themes/lara-light-blue/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";

const PRIME_CONFIG = {
  ripple: true,
  inputStyle: "outlined" as const,
};

export function CrmPrimeProvider({ children }: { children: React.ReactNode }) {
  return (
    <PrimeReactProvider value={PRIME_CONFIG}>
      <div className="crm-prime">{children}</div>
    </PrimeReactProvider>
  );
}
