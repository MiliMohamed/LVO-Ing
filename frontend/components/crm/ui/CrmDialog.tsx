"use client";

import { Dialog } from "primereact/dialog";
import type { ReactNode } from "react";

type Props = {
  visible: boolean;
  onHide: () => void;
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  width?: string;
  maximizable?: boolean;
  blockScroll?: boolean;
};

export function CrmDialog({
  visible,
  onHide,
  header,
  footer,
  children,
  width = "36rem",
  maximizable = false,
  blockScroll = true,
}: Props) {
  return (
    <Dialog
      visible={visible}
      onHide={onHide}
      header={header}
      footer={footer}
      className="crm-dialog"
      style={{ width, maxWidth: "min(96vw, 52rem)" }}
      maximizable={maximizable}
      blockScroll={blockScroll}
      dismissableMask
      draggable={false}
      resizable={false}
      modal
    >
      {children}
    </Dialog>
  );
}
