import { describe, expect, it } from "vitest";
import { isoDuration } from "./youtube";
import { validateSource } from "./downloads";

describe("YouTube durations", () => {
  it("formats minutes and hours", () => {
    expect(isoDuration("PT3M5S")).toBe("3:05");
    expect(isoDuration("PT1H2M3S")).toBe("1:02:03");
  });
});

describe("download sources", () => {
  it("refuses YouTube links (downloads not authorized)", () => {
    expect(() => validateSource("https://www.youtube.com/watch?v=abc")).toThrow(/no permite/);
    expect(() => validateSource("https://youtu.be/abc")).toThrow(/no permite/);
  });
  it("accepts a direct https file link", () => {
    expect(validateSource("https://archive.org/download/x/song.mp3").hostname).toBe("archive.org");
  });
});
