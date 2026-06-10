"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { apiFetch } from "@/lib/api";
import { getApiBaseUrl } from "@/lib/config";
import { canUsePhase2Tools, normalizeRole } from "@/lib/rbac";
import type { SiteArborescenceTreeNode } from "@/lib/types";
import { readRole, readToken } from "@/lib/token-storage";

function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function folderIcon(open: boolean): string {
  return open ? "📂" : "📁";
}

type TreeRowProps = {
  node: SiteArborescenceTreeNode;
  depth: number;
  selectedId: number | null;
  expanded: Set<number>;
  onSelect: (id: number) => void;
  onToggle: (id: number) => void;
};

function TreeRow({ node, depth, selectedId, expanded, onSelect, onToggle }: TreeRowProps) {
  if (node.nodeType !== "FOLDER") return null;
  const isOpen = expanded.has(node.id);
  const hasChildren = node.children.some((c) => c.nodeType === "FOLDER");
  const isSelected = selectedId === node.id;

  return (
    <>
      <button
        type="button"
        className={`site-arbo-tree-row${isSelected ? " site-arbo-tree-row--active" : ""}`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={() => onSelect(node.id)}
      >
        {hasChildren ? (
          <span
            className="site-arbo-tree-chevron"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.id);
            }}
            role="presentation"
          >
            {isOpen ? "▾" : "▸"}
          </span>
        ) : (
          <span className="site-arbo-tree-chevron site-arbo-tree-chevron--empty" />
        )}
        <span className="site-arbo-tree-icon">{folderIcon(isOpen)}</span>
        <span className="site-arbo-tree-label">{node.nom}</span>
      </button>
      {isOpen
        ? node.children
            .filter((c) => c.nodeType === "FOLDER")
            .map((child) => (
              <TreeRow
                key={child.id}
                node={child}
                depth={depth + 1}
                selectedId={selectedId}
                expanded={expanded}
                onSelect={onSelect}
                onToggle={onToggle}
              />
            ))
        : null}
    </>
  );
}

export function SiteArborescencePanel({ siteId, siteNom }: { siteId: number; siteNom?: string }) {
  const canEdit = canUsePhase2Tools(normalizeRole(readRole()));
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tree, setTree] = useState<SiteArborescenceTreeNode[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const load = useCallback(() => {
    const token = readToken();
    void (async () => {
      try {
        const data = (await apiFetch(`/api/sites/${siteId}/arborescence/tree`, { token })) as
          | SiteArborescenceTreeNode[]
          | null;
        const nodes = Array.isArray(data) ? data : [];
        setTree(nodes);
        setErr(null);
        setSelectedFolderId((prev) => {
          if (prev != null) return prev;
          return nodes.length > 0 ? nodes[0].id : null;
        });
        setExpanded((prev) => (prev.size > 0 ? prev : new Set(nodes.map((n) => n.id))));
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Erreur");
        setTree([]);
      }
    })();
  }, [siteId]);

  useEffect(() => {
    load();
  }, [load]);

  const folderMap = useMemo(() => {
    const map = new Map<number, SiteArborescenceTreeNode>();
    function walk(nodes: SiteArborescenceTreeNode[]) {
      for (const n of nodes) {
        if (n.nodeType === "FOLDER") {
          map.set(n.id, n);
          walk(n.children);
        }
      }
    }
    if (tree) walk(tree);
    return map;
  }, [tree]);

  const selectedFolder = selectedFolderId != null ? folderMap.get(selectedFolderId) : null;
  const files = selectedFolder?.children.filter((c) => c.nodeType === "FILE") ?? [];

  const breadcrumb = useMemo(() => {
    if (!selectedFolderId || !tree) return [];
    const path: SiteArborescenceTreeNode[] = [];
    function find(nodes: SiteArborescenceTreeNode[], target: number, acc: SiteArborescenceTreeNode[]): boolean {
      for (const n of nodes) {
        const next = [...acc, n];
        if (n.id === target) {
          path.push(...next);
          return true;
        }
        if (n.nodeType === "FOLDER" && find(n.children, target, next)) return true;
      }
      return false;
    }
    find(tree, selectedFolderId, []);
    return path;
  }, [selectedFolderId, tree]);

  function toggleExpand(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onUpload(file: File) {
    if (!selectedFolderId) return;
    setBusy(true);
    setErr(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const token = readToken();
      const res = await fetch(
        `${getApiBaseUrl()}/api/sites/${siteId}/arborescence/nodes/${selectedFolderId}/files`,
        {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: form,
        },
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Upload échoué");
      }
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur upload");
    } finally {
      setBusy(false);
    }
  }

  async function removeFile(fileId: number) {
    if (!globalThis.confirm("Supprimer ce fichier ?")) return;
    setBusy(true);
    setErr(null);
    try {
      await apiFetch(`/api/sites/${siteId}/arborescence/files/${fileId}`, {
        token: readToken(),
        method: "DELETE",
      });
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur suppression");
    } finally {
      setBusy(false);
    }
  }

  function downloadUrl(fileId: number): string {
    return `${getApiBaseUrl()}/api/sites/${siteId}/arborescence/files/${fileId}/download`;
  }

  return (
    <div className="site-arbo-panel">
      <div className="site-arbo-panel-hdr">
        <div>
          <h3 className="site-arbo-title">Documents du site</h3>
          <p className="crm-hint">
            Arborescence interne{siteNom ? ` — ${siteNom}` : ""} (20 dossiers standard LVO).
          </p>
        </div>
        {canEdit && selectedFolderId ? (
          <>
            <input
              ref={fileInputRef}
              type="file"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onUpload(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              className="cbtn cbtn-primary cbtn-sm"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              Ajouter un fichier
            </button>
          </>
        ) : null}
      </div>

      {err ? <p className="crm-field-error">{err}</p> : null}

      {tree == null ? (
        <p className="crm-hint">Chargement de l&apos;arborescence…</p>
      ) : tree.length === 0 ? (
        <p className="crm-hint">Aucun dossier — l&apos;arborescence sera créée au prochain démarrage serveur.</p>
      ) : (
        <div className="site-arbo-layout">
          <nav className="site-arbo-tree" aria-label="Dossiers du site">
            {tree.map((node) => (
              <TreeRow
                key={node.id}
                node={node}
                depth={0}
                selectedId={selectedFolderId}
                expanded={expanded}
                onSelect={setSelectedFolderId}
                onToggle={toggleExpand}
              />
            ))}
          </nav>

          <div className="site-arbo-files">
            {breadcrumb.length > 0 ? (
              <div className="site-arbo-breadcrumb">
                {breadcrumb.map((n, i) => (
                  <span key={n.id}>
                    {i > 0 ? <span className="site-arbo-breadcrumb-sep">/</span> : null}
                    <button type="button" className="site-arbo-breadcrumb-link" onClick={() => setSelectedFolderId(n.id)}>
                      {n.nom}
                    </button>
                  </span>
                ))}
              </div>
            ) : null}

            <table className="crm-table site-arbo-file-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Taille</th>
                  <th>Ajouté le</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {files.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="crm-hint">
                      Aucun fichier dans ce dossier.
                    </td>
                  </tr>
                ) : (
                  files.map((f) => (
                    <tr key={f.id}>
                      <td>
                        <span className="site-arbo-file-icon">📄</span> {f.nom}
                      </td>
                      <td>{formatBytes(f.sizeBytes)}</td>
                      <td>{f.createdAt ? new Date(f.createdAt).toLocaleString("fr-FR") : "—"}</td>
                      <td className="site-arbo-file-actions">
                        <a
                          className="cbtn cbtn-ghost cbtn-sm"
                          href={downloadUrl(f.id)}
                          download={f.nom}
                          onClick={(e) => {
                            const token = readToken();
                            if (!token) return;
                            e.preventDefault();
                            void fetch(downloadUrl(f.id), {
                              headers: { Authorization: `Bearer ${token}` },
                            }).then(async (res) => {
                              if (!res.ok) throw new Error("Téléchargement échoué");
                              const blob = await res.blob();
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = f.nom;
                              a.click();
                              URL.revokeObjectURL(url);
                            });
                          }}
                        >
                          Télécharger
                        </a>
                        {canEdit ? (
                          <button
                            type="button"
                            className="cbtn cbtn-danger cbtn-sm"
                            disabled={busy}
                            onClick={() => void removeFile(f.id)}
                          >
                            Supprimer
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
