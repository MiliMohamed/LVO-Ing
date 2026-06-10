import "@/app/crm-prime.css";

import { CrmShell } from "@/components/crm/CrmShell";
import { CrmToastProvider } from "@/components/crm/CrmToast";
import { CrmPrimeProvider } from "@/components/crm/prime/CrmPrimeProvider";

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <CrmPrimeProvider>
      <CrmToastProvider>
        <CrmShell>{children}</CrmShell>
      </CrmToastProvider>
    </CrmPrimeProvider>
  );
}
