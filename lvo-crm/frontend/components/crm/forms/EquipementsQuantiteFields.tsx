"use client";

import { AutoComplete, type AutoCompleteCompleteEvent } from "primereact/autocomplete";
import { useState } from "react";

import type { EquipementQteLigne, TypeEquipementRow } from "@/lib/types";

type Props = Readonly<{
  lignes: EquipementQteLigne[];
  onChange: (lignes: EquipementQteLigne[]) => void;
  typesEquipement: TypeEquipementRow[];
}>;

export function EquipementsQuantiteFields({ lignes, onChange, typesEquipement }: Props) {
  const [suggestions, setSuggestions] = useState<string[]>([]);

  function search(e: AutoCompleteCompleteEvent) {
    const q = e.query.trim().toLowerCase();
    const libelles = typesEquipement.map((t) => t.libelle);
    setSuggestions(q ? libelles.filter((l) => l.toLowerCase().includes(q)) : libelles);
  }

  function updateLigne(i: number, patch: Partial<EquipementQteLigne>) {
    onChange(lignes.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function removeLigne(i: number) {
    onChange(lignes.filter((_, idx) => idx !== i));
  }

  function addLigne() {
    onChange([...lignes, { typeLibelle: "", quantite: 1 }]);
  }

  return (
    <div className="crm-stack crm-span-2">
      <p className="crm-stack-title">
        <span className="crm-stack-title__icon" aria-hidden>⚙</span> Équipements du site
      </p>
      <p className="crm-hint" style={{ marginBottom: 10 }}>
        Facultatif — un site peut n&apos;avoir aucun équipement renseigné.
      </p>
      {lignes.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
          {lignes.map((ligne, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <div style={{ flex: 2 }}>
                <AutoComplete
                  value={ligne.typeLibelle}
                  suggestions={suggestions}
                  completeMethod={search}
                  onChange={(e) => {
                    if (typeof e.value === "string") updateLigne(i, { typeLibelle: e.value });
                  }}
                  onSelect={(e) => updateLigne(i, { typeLibelle: String(e.value) })}
                  placeholder="Type d'équipement (ex : Ascenseur)…"
                  className="w-full crm-equip-autocomplete"
                  inputClassName="crm-input w-full"
                  panelClassName="crm-equip-autocomplete-panel"
                  dropdown
                  forceSelection={false}
                />
              </div>
              <input
                type="number"
                min={0}
                step={1}
                className="crm-input"
                style={{ flex: 1 }}
                value={ligne.quantite}
                onChange={(e) => updateLigne(i, { quantite: Math.max(0, Number(e.target.value) || 0) })}
                placeholder="Nombre"
              />
              <button
                type="button"
                className="cbtn cbtn-ghost cbtn-sm"
                onClick={() => removeLigne(i)}
                aria-label="Supprimer cette ligne d'équipement"
              >
                Supprimer
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <button type="button" className="cbtn cbtn-ghost cbtn-sm" onClick={addLigne}>
        + Ajouter un équipement
      </button>
    </div>
  );
}
