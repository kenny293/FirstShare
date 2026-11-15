import { describe, expect, it } from "vitest";
import { fallbackFor, parseCoachOutput, sanitizeCoachRequest } from "./coach";

describe("coach output parsing", () => {
  const good = JSON.stringify({
    feedback: "You put 80% in one company, so your $1,340 result depended on it.",
    mistake_type: "concentration",
    encouragement: "Nice work finishing!",
  });

  it("accepts valid structured output", () => {
    const r = parseCoachOutput(good, ["concentration"]);
    expect(r?.source).toBe("ai");
    expect(r?.mistake_type).toBe("concentration");
  });

  it("forces mistake_type to match what the code detected", () => {
    const r = parseCoachOutput(good, ["panic_selling"]);
    expect(r?.mistake_type).toBe("panic_selling");
  });

  it("rejects malformed output", () => {
    expect(parseCoachOutput("not json", ["none"])).toBeNull();
    expect(parseCoachOutput(JSON.stringify({ feedback: 3 }), ["none"])).toBeNull();
    expect(parseCoachOutput(undefined, ["none"])).toBeNull();
  });

  it("falls back to a pre-written message per mistake", () => {
    expect(fallbackFor(["high_fees"]).mistake_type).toBe("high_fees");
    expect(fallbackFor([]).mistake_type).toBe("none");
    expect(fallbackFor(["panic_selling"]).source).toBe("fallback");
  });
});

describe("coach request sanitizing", () => {
  it("drops unknown mistakes and clamps long text", () => {
    const r = sanitizeCoachRequest({
      detectedMistakes: ["concentration", "evil"],
      decisions: [{ reasoning: "x".repeat(5000), choice: "Hold" }],
      finalValue: 1234.567,
    });
    expect(r?.detectedMistakes).toEqual(["concentration"]);
    expect(r?.decisions[0].reasoning.length).toBe(500);
    expect(r?.finalValue).toBe(1234.57);
  });

  it("defaults to none when nothing detected", () => {
    expect(sanitizeCoachRequest({})?.detectedMistakes).toEqual(["none"]);
    expect(sanitizeCoachRequest(null)).toBeNull();
  });
});
