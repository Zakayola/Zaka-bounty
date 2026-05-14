import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zaka-Bounty | Decentralized Escrow Market",
  description: "Incentivizing open-source contributions with on-chain Soroban escrows.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-stellar flex items-center justify-center font-bold text-white">
                Z
              </div>
              <span className="text-xl font-bold tracking-tight">Zaka-Bounty</span>
            </div>
            <nav className="flex gap-4">
              <a href="#" className="text-sm text-slate-400 hover:text-white transition-colors">Explorer</a>
              <a href="https://github.com/zakayola/Zaka-Bounty" target="_blank" rel="noreferrer" className="text-sm text-slate-400 hover:text-white transition-colors">GitHub</a>
            </nav>
          </div>
        </header>

        <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-12">
          {children}
        </main>

        <footer className="border-t border-slate-800 py-8 text-center text-slate-500 text-sm">
          <p>© {new Date().getFullYear()} Zaka-Bounty. A Stellar Drips Wave project by AlAfiz.</p>
        </footer>
      </body>
    </html>
  );
}
