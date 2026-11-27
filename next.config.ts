import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// CSP: por padrão só REPORTA violações (Content-Security-Policy-Report-Only). Com CSP_ENFORCE=1 passa a bloquear.
// 'unsafe-inline' em script-src porque o Next injeta scripts inline e não usamos nonce (nonce exigiria render dinâmico + proxy).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://i.ytimg.com",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws://localhost:*" : ""}`,
  "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

// Toda tela depende do aluno logado (progresso, anotações), então nada é pré-renderizado:
// cacheComponents fica desligado de propósito.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // O app não é embutido em lugar nenhum (vale para o nosso site; o iframe do YouTube que nós embutimos não é afetado).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: process.env.CSP_ENFORCE === "1" ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only", value: csp },
];

const nextConfig: NextConfig = {
  // Doca (VM): imagem Docker enxuta com o servidor do Next. Na Vercel o "standalone" é ignorado.
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  images: { remotePatterns: [{ protocol: "https", hostname: "i.ytimg.com" }] },
  // Há um package-lock.json em C:\Users\Samue; sem isto o Turbopack pega a pasta errada como raiz.
  turbopack: { root: __dirname },
};

export default nextConfig;
