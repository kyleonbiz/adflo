import { describe, expect, it } from "vitest";
import { publicOrigin } from "@/lib/public-origin";

const at = (url: string) => ({ origin: new URL(url).origin, hostname: new URL(url).hostname });

describe("publicOrigin", () => {
  it("turns a vercel.app address into the real domain", () => {
    expect(publicOrigin(at("https://adflo-abc.vercel.app/app"), {})).toBe("https://www.adflo.pro");
  });
  it("keeps previews and local development on their own address", () => {
    expect(publicOrigin(at("https://adflo-abc.vercel.app"), { NEXT_PUBLIC_VERCEL_ENV: "preview" })).toBe("https://adflo-abc.vercel.app");
    expect(publicOrigin(at("http://localhost:3000"), {})).toBe("http://localhost:3000");
  });
  it("leaves the real domain alone and honours NEXT_PUBLIC_SITE_URL", () => {
    expect(publicOrigin(at("https://www.adflo.pro"), {})).toBe("https://www.adflo.pro");
    expect(publicOrigin(at("http://localhost:3000"), { NEXT_PUBLIC_SITE_URL: "https://www.adflo.pro/" })).toBe("https://www.adflo.pro");
  });
});
