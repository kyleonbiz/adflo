import { ImageResponse } from "next/og";

export const alt = "AdFlo · Administrative management platform";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The link preview shown when the site is shared (also used as the Twitter card image). */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 90px",
          color: "white",
          background: "linear-gradient(135deg, #040826 0%, #0b2a7a 55%, #287cff 100%)",
        }}
      >
        <div style={{ display: "flex", fontSize: 120, fontWeight: 700, letterSpacing: -3 }}>AdFlo</div>
        <div style={{ display: "flex", marginTop: 8, fontSize: 52, fontWeight: 600 }}>Administrative management platform</div>
        <div style={{ display: "flex", marginTop: 28, fontSize: 32, color: "#c9d7ff", lineHeight: 1.35, maxWidth: 940 }}>
          Records, compliance deadlines, and equipment and asset tracking for contractors and property managers, in one place.
        </div>
      </div>
    ),
    size,
  );
}
