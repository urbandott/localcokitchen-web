"use client";

import type { ComponentPropsWithoutRef, FormEvent } from "react";

type FilterMode = "decimal" | "digits" | "noLetters" | "phone";

type FilteredInputProps = Omit<ComponentPropsWithoutRef<"input">, "onBeforeInput" | "onInput"> & {
  decimalPlaces?: number;
  filter: FilterMode;
  maxIntegerDigits?: number;
};

export function sanitizeInputValue(
  value: string,
  filter: FilterMode,
  options: { decimalPlaces?: number; maxIntegerDigits?: number } = {},
): string {
  if (filter === "digits") return value.replace(/\D/g, "");
  if (filter === "phone") return value.replace(/[^0-9+().\s-]/g, "");
  if (filter === "noLetters") return value.replace(/\p{L}/gu, "");

  const decimalPlaces = options.decimalPlaces ?? 2;
  const maxIntegerDigits = options.maxIntegerDigits ?? Number.POSITIVE_INFINITY;
  const cleaned = value.replace(/[^\d.]/g, "");
  const [integer = "", ...fractionParts] = cleaned.split(".");
  const normalizedInteger = integer.slice(0, maxIntegerDigits);
  if (fractionParts.length === 0) return normalizedInteger;
  return `${normalizedInteger}.${fractionParts.join("").slice(0, decimalPlaces)}`;
}

function inputSelection(input: HTMLInputElement) {
  return {
    end: input.selectionEnd ?? input.value.length,
    start: input.selectionStart ?? input.value.length,
  };
}

export function FilteredInput({
  decimalPlaces,
  filter,
  maxIntegerDigits,
  ...props
}: FilteredInputProps) {
  function sanitize(value: string) {
    return sanitizeInputValue(value, filter, { decimalPlaces, maxIntegerDigits });
  }

  function blockInvalidBeforeInput(event: FormEvent<HTMLInputElement>) {
    const nativeEvent = event.nativeEvent as InputEvent;
    if (!nativeEvent.data || nativeEvent.inputType.startsWith("delete")) return;

    const input = event.currentTarget;
    const { end, start } = inputSelection(input);
    const proposed = `${input.value.slice(0, start)}${nativeEvent.data}${input.value.slice(end)}`;
    if (sanitize(proposed) !== proposed) event.preventDefault();
  }

  function sanitizeCurrentValue(event: FormEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const sanitized = sanitize(input.value);
    if (input.value === sanitized) return;

    const { start } = inputSelection(input);
    const removedBeforeCursor =
      input.value.slice(0, start).length - sanitize(input.value.slice(0, start)).length;
    input.value = sanitized;
    const nextCursor = Math.max(0, start - removedBeforeCursor);
    input.setSelectionRange(nextCursor, nextCursor);
  }

  return (
    <input {...props} onBeforeInput={blockInvalidBeforeInput} onInput={sanitizeCurrentValue} />
  );
}
