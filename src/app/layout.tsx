import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { StoreProvider } from "@/lib/store/StoreProvider";

export const metadata: Metadata = {
  title: "Labbay",
  description: "Keeps every student hearing from you, week after week.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full bg-[#FFFFFF] text-[#111114] antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet" />
        <script src="https://unpkg.com/@lottiefiles/lottie-player@2.0.4/dist/lottie-player.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/iconify-icon@3.0.2/dist/iconify-icon.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.4/dist/confetti.browser.js"></script>
      </head>
      <body className="min-h-full bg-[#FFFFFF] text-[#111114] font-['Inter',sans-serif] selection:bg-[#FF4B2B]/20 selection:text-[#FF4B2B]">
        <StoreProvider>
          <AppShell>{children}</AppShell>
        </StoreProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              document.addEventListener('click', function(e) {
                const target = e.target && e.target.closest ? e.target.closest('button, a, input[type="submit"], [role="button"]') : null;
                if (target) {
                  try { new Audio('https://cdn.jsdelivr.net/npm/uisfx@0.4.0/sounds/minimal/press.mp3').play(); } catch(err){}
                }
              }, true);
            `
          }}
        />
      </body>
    </html>
  );
}