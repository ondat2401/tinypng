/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["tinify"],
  outputFileTracingRoot: import.meta.dirname,
  // Cho phép build vào thư mục riêng (tránh xung đột với next dev đang chạy)
  ...(process.env.BUILD_DIST ? { distDir: process.env.BUILD_DIST } : {}),
};

export default nextConfig;
