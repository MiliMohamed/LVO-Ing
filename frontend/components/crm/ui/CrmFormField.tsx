"use client";

import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import type { ReactNode } from "react";

type BaseProps = {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
};

type TextProps = BaseProps & {
  type?: "text" | "email" | "tel" | "number" | "date";
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

type TextareaProps = BaseProps & {
  multiline: true;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
};

type SelectProps = BaseProps & {
  select: true;
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
  placeholder?: string;
  disabled?: boolean;
};

type CustomProps = BaseProps & {
  children: ReactNode;
};

export type CrmFormFieldProps = TextProps | TextareaProps | SelectProps | CustomProps;

function isSelect(p: CrmFormFieldProps): p is SelectProps {
  return "select" in p && p.select === true;
}

function isMultiline(p: CrmFormFieldProps): p is TextareaProps {
  return "multiline" in p && p.multiline === true;
}

function isCustom(p: CrmFormFieldProps): p is CustomProps {
  return "children" in p && !("value" in p);
}

export function CrmFormField(props: CrmFormFieldProps) {
  const { label, htmlFor, hint, error, required, className = "" } = props;

  let control: ReactNode;

  if (isCustom(props)) {
    control = props.children;
  } else if (isSelect(props)) {
    control = (
      <Dropdown
        inputId={htmlFor}
        value={props.value}
        options={props.options}
        onChange={(e) => props.onChange(String(e.value ?? ""))}
        placeholder={props.placeholder}
        disabled={props.disabled}
        className="w-full"
      />
    );
  } else if (isMultiline(props)) {
    control = (
      <InputTextarea
        id={htmlFor}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        rows={props.rows ?? 4}
        disabled={props.disabled}
        className="w-full"
        autoResize
      />
    );
  } else {
    control = (
      <InputText
        id={htmlFor}
        type={props.type ?? "text"}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        disabled={props.disabled}
        className="w-full"
        invalid={!!error}
      />
    );
  }

  return (
    <div className={`crm-form-field ${className}`.trim()}>
      <label htmlFor={htmlFor} className="crm-field-label">
        {label}
        {required ? (
          <span className="text-[var(--orange)]" aria-hidden>
            {" "}
            *
          </span>
        ) : null}
      </label>
      {control}
      {hint && !error ? <p className="crm-field-hint">{hint}</p> : null}
      {error ? <p className="crm-field-error" role="alert">{error}</p> : null}
    </div>
  );
}
