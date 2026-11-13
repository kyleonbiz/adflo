import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // A full script-src needs per-request nonces with Next; these directives are safe without them.
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The text reader for photos and scans runs worker threads and reads its language data from disk.
  serverExternalPackages: ["tesseract.js", "@napi-rs/canvas"],
  // Only a production build needs the files copied next to the route; listing them in development makes the dev server
  // rebuild and reload the page over and over.
  ...(process.env.NODE_ENV === "production"
    ? {
        outputFileTracingIncludes: {
          // Only the engine builds (.js loader + .wasm) are read at run time. The single-file "*.wasm.js" copies are browser
          // bundles that this server code never loads (~25 MB saved), so they are left out.
          "/api/licenses/parse": [
            "./node_modules/tesseract.js/**/*",
            "./node_modules/tesseract.js-core/package.json",
            "./node_modules/tesseract.js-core/index.js",
            "./node_modules/tesseract.js-core/tesseract-core*.wasm",
            ...["", "-lstm", "-simd", "-simd-lstm", "-relaxedsimd", "-relaxedsimd-lstm"].map((v) => `./node_modules/tesseract.js-core/tesseract-core${v}.js`),
            "./node_modules/@tesseract.js-data/eng/4.0.0/**/*",
          ],
        },
        // Vercel runs glibc Linux, so the musl build of the PDF page renderer is never loaded (~33 MB saved per function).
        outputFileTracingExcludes: { "*": ["./node_modules/@napi-rs/canvas-linux-x64-musl/**/*"] },
      }
    : {}),
  // Old shared links to the public demo still work: they now open the same screen inside the app.
  async redirects() {
    return [
      { source: "/demo", destination: "/app/overview", permanent: true },
      { source: "/demo/documents", destination: "/app", permanent: true },
      { source: "/demo/:path*", destination: "/app/:path*", permanent: true },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    // The scanned-PDF reader draws pages with a native library; the browser build must never try to load it.
    resolveAlias: { "@napi-rs/canvas": { browser: "./src/lib/empty/native-stub.ts" } },
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
