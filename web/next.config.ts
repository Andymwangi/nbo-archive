import type { NextConfig } from "next";

type RemotePattern = NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]>[number];

// Photos are served from the API's public origin, or from MEDIA_BASE_URL when the API is told to
// build image URLs from a different one (a CDN or a separate media host).
function mediaPattern(origin: string): RemotePattern {
  const url = new URL(origin);
  return {
    protocol: url.protocol.replace(":", "") as "http" | "https",
    hostname: url.hostname,
    port: url.port,
    pathname: "/media/**",
  };
}

const mediaOrigins = [
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8010",
  process.env.MEDIA_BASE_URL,
].filter((origin): origin is string => Boolean(origin));

const nextConfig: NextConfig = {
  // The Docker image sets NEXT_OUTPUT=standalone; local `next start` needs the regular output.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  images: {
    formats: ["image/avif", "image/webp"],
    // Dev serves media from the API on localhost, which Next 16 blocks by default.
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== "production",
    remotePatterns: [
      ...mediaOrigins.map(mediaPattern),
      { protocol: "https", hostname: "res.cloudinary.com", pathname: "/**" },
    ],
  },
};

export default nextConfig;
