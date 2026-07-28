import { describe, expect, it } from "vitest";

import { isValidNomorNota } from "./nota-validation";

describe("isValidNomorNota", () => {
  it.each(["INV001", "A-0001", " Nota99 "])("menerima %s", (nota) => {
    expect(isValidNomorNota(nota)).toBe(true);
  });

  it.each(["A1234", "123456", "INV-XX", "", " A1234 "])(
    "menolak %s",
    (nota) => {
      expect(isValidNomorNota(nota)).toBe(false);
    },
  );
});
