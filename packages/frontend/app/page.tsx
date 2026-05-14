"use client";

import { useState, useEffect } from "react";
import { isAllowed, setAllowed, requestAccess, getPublicKey } from "@stellar/freighter-api";

// Mock data until the backend is fully connected
const MOCK_BOUNTIES = [
  {
    id: "1",
    description: "Implement Arbiter Multi-Sig Dispute Resolution in Rust Contract",
    reward: "200 USDC",
    status: "open",
    maintainer: "GD3...A4Q",
  },
  {
    id: "2",
    description: "Add Fastify Endpoint to Search Bounties by Developer Public Key",
    reward: "150 USDC",
    status: "claimed",
    maintainer: "GD3...A4Q",
  },
  {
    id: "3",
    description: "Update Frontend Typography & Add 'How It Works' Section",
    reward: "100 USDC",
    status: "completed",
    maintainer: "GD3...A4Q",
  }
];

export default function Home() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    checkWalletConnection();
  }, []);

  const checkWalletConnection = async () => {
    if (await isAllowed()) {
      const pubKey = await getPublicKey();
      if (pubKey) setWalletAddress(pubKey);
    }
  };

  const connectWallet = async () => {
    setIsConnecting(true);
    try {
      await setAllowed();
      const pubKey = await requestAccess();
      if (pubKey) {
        setWalletAddress(pubKey);
      }
    } catch (error) {
      console.error("Wallet connection failed:", error);
    } finally {
      setIsConnecting(false);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 5)}...${address.slice(-4)}`;
  };

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="text-center space-y-6 max-w-3xl mx-auto">
        <h1 className="text-5xl font-extrabold tracking-tight">
          Ship code. <span className="text-stellar text-transparent bg-clip-text bg-gradient-to-r from-stellar to-purple-400">Get paid trustlessly.</span>
        </h1>
        <p className="text-xl text-slate-400 leading-relaxed">
          Zaka-Bounty is a decentralized open-source market. Maintainers lock USDC on Soroban, you claim the issue, ship the PR, and get paid automatically. No middlemen.
        </p>
        <div className="pt-4">
          {!walletAddress ? (
            <button 
              onClick={connectWallet} 
              disabled={isConnecting}
              className="btn-primary text-lg px-8 py-3"
            >
              {isConnecting ? "Connecting..." : "Connect Freighter Wallet"}
            </button>
          ) : (
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-slate-800 rounded-full border border-slate-700">
              <div className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
              <span className="font-mono text-sm">{formatAddress(walletAddress)}</span>
            </div>
          )}
        </div>
      </section>

      {/* Bounty Explorer */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Bounty Explorer</h2>
          <div className="flex gap-2">
            <span className="px-3 py-1 text-xs font-medium rounded-full bg-slate-800 text-slate-300">All</span>
            <span className="px-3 py-1 text-xs font-medium rounded-full bg-slate-800/50 text-slate-500 hover:bg-slate-800 cursor-pointer transition-colors">Open</span>
          </div>
        </div>

        <div className="grid gap-4">
          {MOCK_BOUNTIES.map((bounty) => (
            <div key={bounty.id} className="p-6 rounded-xl border border-slate-800 bg-slate-800/20 hover:bg-slate-800/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-0.5 rounded text-xs font-medium uppercase tracking-wider
                    ${bounty.status === 'open' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 
                      bounty.status === 'claimed' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' : 
                      'bg-slate-500/10 text-slate-400 border border-slate-500/20'}`}
                  >
                    {bounty.status}
                  </span>
                  <span className="text-sm font-mono text-slate-500">Maintainer: {bounty.maintainer}</span>
                </div>
                <h3 className="text-lg font-medium">{bounty.description}</h3>
              </div>
              
              <div className="flex items-center gap-6 md:justify-end">
                <div className="text-right">
                  <p className="text-sm text-slate-500 mb-1">Reward</p>
                  <p className="font-bold text-xl text-emerald-400">{bounty.reward}</p>
                </div>
                {bounty.status === 'open' && (
                  <button className="btn-secondary h-fit whitespace-nowrap">
                    Claim Bounty
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
