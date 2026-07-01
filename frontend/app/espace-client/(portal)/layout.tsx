"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ClientSidebar } from "@/components/espace-client/ClientSidebar";
import { ClientTopNav } from "@/components/espace-client/ClientTopNav";
import { SiteProvider, useSelectedSite } from "@/lib/site-context";

const MAX_TABS = 5;

function SiteHubBar() {
  const { sites, selectedSiteId, selectedSite, setSiteId, loading } = useSelectedSite();
  const [pillStyle, setPillStyle] = useState<{ left: number; width: number } | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const visibleSites = sites.slice(0, MAX_TABS);
  const overflowSites = sites.slice(MAX_TABS);
  const overflowActive = overflowSites.some((s) => s.id === selectedSiteId);

  // Slide the pill to the active visible tab
  useLayoutEffect(() => {
    const idx = visibleSites.findIndex((s) => s.id === selectedSiteId);
    const btn = btnRefs.current[idx];
    const container = tabsRef.current;
    if (idx !== -1 && btn && container) {
      const cRect = container.getBoundingClientRect();
      const bRect = btn.getBoundingClientRect();
      setPillStyle({ left: bRect.left - cRect.left, width: bRect.width });
    } else {
      setPillStyle(null);
    }
  }, [selectedSiteId, sites.length]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [dropdownOpen]);

  if (loading) return null;
  if (sites.length === 0) return null;

  return (
    <div
      className="site-hub-bar"
      style={{
        position: "fixed",
        top: 48,
        right: 0,
        zIndex: 90,
        background: "#fff",
        borderBottom: "1px solid var(--g200)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        padding: "0 20px",
        display: "flex",
        alignItems: "center",
        height: 44,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "var(--g500)",
          textTransform: "uppercase",
          letterSpacing: 0.8,
          marginRight: 14,
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        Site actif
      </span>

      {/* Tab row with sliding pill */}
      <div ref={tabsRef} style={{ position: "relative", display: "flex", gap: 2, alignItems: "center" }}>
        {/* Animated background pill */}
        {pillStyle && (
          <div
            style={{
              position: "absolute",
              top: 2,
              bottom: 2,
              left: pillStyle.left,
              width: pillStyle.width,
              background: "var(--navy)",
              borderRadius: 8,
              transition: "left 0.22s cubic-bezier(0.4,0,0.2,1), width 0.22s cubic-bezier(0.4,0,0.2,1)",
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
        )}

        {visibleSites.map((s, i) => {
          const active = s.id === selectedSiteId;
          return (
            <button
              key={s.id}
              ref={(el) => { btnRefs.current[i] = el; }}
              type="button"
              onClick={() => setSiteId(s.id)}
              style={{
                position: "relative",
                zIndex: 1,
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 13px",
                borderRadius: 8,
                border: "none",
                background: "transparent",
                color: active ? "#fff" : "var(--g600)",
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "color 0.18s",
              }}
            >
              <span style={{ fontSize: 14 }}>🏢</span>
              {s.nom}
              {s.typeSite ? (
                <span
                  style={{
                    fontSize: 10,
                    background: active ? "rgba(255,255,255,0.18)" : "var(--g200)",
                    color: active ? "rgba(255,255,255,0.85)" : "var(--g500)",
                    borderRadius: 4,
                    padding: "1px 5px",
                    fontWeight: 600,
                    transition: "background 0.18s, color 0.18s",
                  }}
                >
                  {s.typeSite}
                </span>
              ) : null}
            </button>
          );
        })}

        {/* Overflow dropdown */}
        {overflowSites.length > 0 && (
          <div ref={dropdownRef} style={{ position: "relative", zIndex: 1, marginLeft: 2 }}>
            <button
              type="button"
              onClick={() => setDropdownOpen((v) => !v)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "5px 11px",
                borderRadius: 8,
                border: overflowActive ? "none" : "1.5px solid var(--g200)",
                background: overflowActive ? "var(--navy)" : "var(--g50)",
                color: overflowActive ? "#fff" : "var(--g600)",
                fontSize: 12,
                fontWeight: overflowActive ? 700 : 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s",
              }}
            >
              +{overflowSites.length}
              <svg width="8" height="5" viewBox="0 0 8 5" fill="none" style={{ opacity: 0.6, transition: "transform 0.15s", transform: dropdownOpen ? "rotate(180deg)" : "none" }}>
                <path d="M1 1l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {dropdownOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  left: 0,
                  background: "#fff",
                  border: "1px solid var(--g200)",
                  borderRadius: 10,
                  boxShadow: "var(--sh2)",
                  padding: 4,
                  minWidth: 190,
                  zIndex: 200,
                }}
              >
                {overflowSites.map((s) => {
                  const active = s.id === selectedSiteId;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => { setSiteId(s.id); setDropdownOpen(false); }}
                      style={{
                        display: "flex",
                        width: "100%",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 12px",
                        borderRadius: 7,
                        border: "none",
                        background: active ? "var(--navy)" : "transparent",
                        color: active ? "#fff" : "var(--g800)",
                        fontSize: 13,
                        fontWeight: active ? 700 : 400,
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "background 0.1s",
                      }}
                    >
                      <span style={{ fontSize: 14 }}>🏢</span>
                      <span style={{ flex: 1 }}>{s.nom}</span>
                      {s.typeSite && (
                        <span style={{ fontSize: 10, color: active ? "rgba(255,255,255,0.7)" : "var(--g500)", fontWeight: 600 }}>
                          {s.typeSite}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right: client name */}
      {selectedSite && (
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            flexShrink: 0,
            paddingLeft: 20,
          }}
        >
          <span
            style={{
              fontSize: 11,
              color: "var(--g500)",
              borderLeft: "1px solid var(--g200)",
              paddingLeft: 16,
            }}
          >
            {selectedSite.clientNom}
          </span>
        </div>
      )}
    </div>
  );
}

function PortalInner({ children }: Readonly<{ children: React.ReactNode }>) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div style={{ minHeight: "100vh", background: "var(--g50, #f5f6fa)" }}>
      <ClientTopNav onToggleSidebar={() => setSidebarOpen((v) => !v)} />
      <SiteHubBar />
      {/* paddingTop: 48 (topnav) + 44 (site bar) = 92 */}
      <div style={{ display: "flex", paddingTop: 92 }}>
        {sidebarOpen && (
          <div
            className="crm-sidebar-overlay crm-sidebar-overlay--visible"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}
        <ClientSidebar isOpen={sidebarOpen} />
        <main className="crm-main" onClick={() => sidebarOpen && setSidebarOpen(false)}>
          {children}
        </main>
      </div>
    </div>
  );
}

export default function PortalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  return (
    <SiteProvider>
      <PortalInner>{children}</PortalInner>
    </SiteProvider>
  );
}
