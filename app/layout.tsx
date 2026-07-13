import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TinyCompress — Unlimited image compression",
  description:
    "Compress PNG, JPEG and WebP using the TinyPNG API. Upload an unlimited number of images.",
};

// Set the theme before paint to avoid a flash on page load
const themeScript = `
(function () {
  try {
    var t = localStorage.getItem('theme');
    if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-gradient-to-br from-fuchsia-50 via-white to-violet-100 text-slate-800 transition-colors dark:from-[#150a24] dark:via-[#1b0d2e] dark:to-[#241041] dark:text-slate-100">
        {/* Floating blurred gradient background blobs */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
        >
          <div className="animate-blob absolute -left-24 -top-24 h-72 w-72 rounded-full bg-fuchsia-400/30 blur-3xl dark:bg-fuchsia-600/20" />
          <div
            className="animate-blob absolute -right-24 top-1/3 h-80 w-80 rounded-full bg-violet-500/25 blur-3xl dark:bg-violet-600/20"
            style={{ animationDelay: "3s" }}
          />
          <div
            className="animate-float absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-pink-400/25 blur-3xl dark:bg-pink-600/15"
            style={{ animationDelay: "1.5s" }}
          />
        </div>
        {children}
      </body>
    </html>
  );
}
