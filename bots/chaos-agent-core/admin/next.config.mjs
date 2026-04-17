/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 允許被主站後台以 iframe 嵌入（否則部分瀏覽器／預設 CSP 會阻擋顯示）
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }],
      },
    ];
  },
};

export default nextConfig;
