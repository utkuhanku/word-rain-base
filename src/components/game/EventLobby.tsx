"use client";

import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { useState, useEffect } from "react";
import { useGameStore } from "@/lib/store/gameStore";
import { motion } from "framer-motion";
import { parseAbiItem } from "viem";
import { Identity, Avatar, Name, Address } from '@coinbase/onchainkit/identity';
import PlayerDetailModal from './PlayerDetailModal';

export default function EventLobby({ onBack, onStart }: { onBack: () => void, onStart: () => void }) {
    const { address } = useAccount();
    const { setMode } = useGameStore();
    const { writeContractAsync } = useWriteContract();
    const publicClient = usePublicClient();

    const [isProcessing, setIsProcessing] = useState(false);
    const [hasPaidEntry, setHasPaidEntry] = useState(false);
    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [selectedPlayer, setSelectedPlayer] = useState<any>(null);

    // Check Local Payment Flag for ETHDenver
    useEffect(() => {
        if (!address) return;
        const payKey = `ethdenver_entry_paid_${address}`;
        const isPaid = localStorage.getItem(payKey);
        if (isPaid === 'true') setHasPaidEntry(true);
    }, [address]);

    // Load Leaderboard (ETHDenver Partition)
    useEffect(() => {
        const loadLeaderboard = async () => {
            setIsRefreshing(true);
            try {
                // Fetch from new centralized API
                const res = await fetch(`/api/leaderboard/top?limit=50&_t=${Date.now()}`, {
                    cache: 'no-store'
                });

                if (res.ok) {
                    const data = await res.json();
                    setLeaderboard(data);
                }
            } catch (e) {
                console.error("Leaderboard fetch failed", e);
            } finally {
                setIsRefreshing(false);
            }
        };

        loadLeaderboard();
        const interval = setInterval(loadLeaderboard, 10000);
        return () => clearInterval(interval);
    }, []);



    const handleEntryPayment = async () => {
        if (!address) return;

        // SKIP PAYMENT IF ALREADY PAID
        if (hasPaidEntry) {
            setMode('EVENT'); // Using EVENT mode for now, logic in GameEngine will handle scoring
            onStart();
            return;
        }

        setIsProcessing(true);
        try {
            // 1 USDC Entry Fee
            const ENTRY_FEE = BigInt(1000000); // 1.00 USDC
            const TREASURY = "0x6edd22E9792132614dD487aC6434dec3709b79A8";

            const hash = await writeContractAsync({
                address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base USDC
                abi: [parseAbiItem('function transfer(address to, uint256 value)')],
                functionName: 'transfer',
                args: [TREASURY, ENTRY_FEE]
            });

            if (publicClient) {
                await publicClient.waitForTransactionReceipt({ hash });

                // SAVE LOCAL STATE
                const payKey = `ethdenver_entry_paid_${address}`;
                localStorage.setItem(payKey, 'true');
                setHasPaidEntry(true);

                setMode('EVENT');
                onStart();
            }
        } catch (e) {
            console.error("Entry Failed", e);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="w-full max-w-md mx-auto h-[100dvh] bg-black text-white font-mono flex flex-col relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[60%] bg-[#3B82F6]/20 blur-[120px] rounded-full animate-pulse"></div>
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
            </div>

            {/* Header */}
            <div className="relative z-10 flex items-center justify-between p-6 border-b border-white/5 backdrop-blur-md">
                <button
                    onClick={onBack}
                    className="w-10 h-10 flex items-center justify-center border border-white/10 bg-black/50 hover:bg-white/10 transition-all rounded-full"
                >
                    <span className="text-xl">←</span>
                </button>
                <div className="flex flex-col items-center">
                    <h1 className="text-lg font-black italic tracking-widest uppercase text-white">
                        ETHDENVER <span className="text-[#3B82F6]">SPECIAL</span>
                    </h1>
                    <span className="text-[10px] text-zinc-500 tracking-[0.2em] uppercase">OFFICIAL EVENT</span>
                </div>
                <div className="w-10" /> {/* Spacer */}
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-6 relative z-10 scrollbar-hide space-y-6">

                {/* Prize Pool Card */}
                <div className="relative overflow-hidden rounded-2xl border border-[#3B82F6]/30 bg-[#3B82F6]/5 p-6 text-center">
                    <div className="text-xs text-[#3B82F6] font-bold tracking-widest mb-1">TOTAL PRIZE POOL</div>
                    <div className="text-6xl font-black text-white tracking-tighter drop-shadow-[0_0_20px_rgba(59,130,246,0.5)]">
                        $250
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-2 font-mono">
                        Winners announced at the end of ETHDenver.<br />
                        Highest score single entry wins.
                    </p>
                </div>

                {/* Action Button */}
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleEntryPayment}
                    disabled={isProcessing}
                    className="w-full py-5 bg-white text-black font-black text-xl uppercase tracking-widest rounded-xl relative overflow-hidden group shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                >
                    <span className="relative z-10 flex items-center justify-center gap-3">
                        {isProcessing ? "PROCESSING..." : (hasPaidEntry ? "PLAY NOW" : "ENTER EVENT")}
                        {!hasPaidEntry && <span className="bg-black text-white px-2 py-1 rounded text-xs font-bold font-mono">1 USDC</span>}
                    </span>
                    {hasPaidEntry && <div className="absolute inset-0 bg-[#3B82F6]/20 animate-pulse"></div>}
                </motion.button>

                {/* Leaderboard Header */}
                <div className="flex items-center justify-between px-1 mt-4">
                    <h2 className="text-sm font-bold text-white tracking-wider flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#3B82F6] animate-pulse"></span>
                        LIVE STANDINGS
                    </h2>
                    <button
                        disabled={isRefreshing}
                        className="text-[10px] text-zinc-500 hover:text-white uppercase tracking-widest"
                    >
                        {isRefreshing ? "SYNCING..." : "AUTO-UPDATE"}
                    </button>
                </div>

                {/* Rankings */}
                <div className="space-y-2">
                    {leaderboard.length === 0 ? (
                        <div className="text-center py-12 border border-dashed border-white/10 rounded-xl">
                            <p className="text-zinc-600 text-xs uppercase tracking-widest">No Entries Yet</p>
                        </div>
                    ) : (
                        leaderboard.map((entry: any, i) => (
                            <div
                                key={entry.member || entry.address}
                                className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${i < 3 ? "bg-white/10 border-white/10" : "bg-white/5 border-white/5 hover:bg-white/10"}`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className={`font-mono font-bold w-6 text-center ${i === 0 ? "text-yellow-400 text-lg" : i === 1 ? "text-zinc-300 text-base" : i === 2 ? "text-orange-400 text-base" : "text-zinc-600 text-xs"}`}>
                                        {i + 1}
                                    </span>

                                    <div className="flex flex-col">
                                        <div className="flex flex-col">
                                            {entry.pfp_url ? (
                                                <div className="flex items-center gap-2">
                                                    <img
                                                        src={entry.pfp_url}
                                                        alt="pfp"
                                                        className="w-8 h-8 rounded-full border border-white/10"
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).style.display = 'none';
                                                        }}
                                                    />
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-bold text-white leading-none">
                                                            {entry.username ? `@${entry.username}` : entry.displayName}
                                                        </span>
                                                        {/* STREAK BADGE */}
                                                        {entry.streak > 0 && (
                                                            <div className="flex items-center gap-1 mt-0.5">
                                                                <span className="text-[10px] text-orange-500 font-mono flex items-center gap-0.5">
                                                                    🔥 {entry.streak}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (

                                                (() => {
                                                    const rawAddress = (entry.identifier || entry.member)?.replace('wallet:', '');
                                                    const isValidAddress = rawAddress?.startsWith('0x') && rawAddress.length === 42;
                                                    const address = isValidAddress ? (rawAddress as `0x${string}`) : undefined;

                                                    // Fallback for non-address identities (e.g. un-enriched FIDs in mock mode)
                                                    if (!address) {
                                                        return (
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-8 h-8 rounded-full border border-white/10 bg-zinc-900 flex items-center justify-center text-xs">
                                                                    👤
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="text-xs font-bold text-white leading-none">
                                                                        {entry.displayName || "Unknown Player"}
                                                                    </span>
                                                                    <span className="text-[10px] text-zinc-500 font-mono leading-none">
                                                                        {entry.type === 'fid' ? `FID: ${entry.identifier}` : 'Guest'}
                                                                    </span>
                                                                    {entry.streak > 0 && (
                                                                        <span className="text-[10px] text-orange-500 font-mono flex items-center gap-0.5 mt-0.5">
                                                                            🔥 {entry.streak}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    }


                                                    const formattedAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;

                                                    return (
                                                        <div className="flex items-center gap-2">
                                                            {/* Avatar Isolated */}
                                                            <Identity address={address}>
                                                                <Avatar className="w-8 h-8 rounded-full border border-white/10" />
                                                            </Identity>

                                                            <div className="flex flex-col">
                                                                {/* Name Isolated */}
                                                                <Identity address={address}>
                                                                    <Name className="text-xs font-bold text-white leading-none min-h-[12px]">
                                                                        {/* Fallback to API data if Name component yields nothing/loading? 
                                                                             OnchainKit Name usually handles this, but since user is having issues, 
                                                                             we trust the server's displayName as a reasonable "loading" state or backup. */}
                                                                    </Name>
                                                                </Identity>

                                                                {/* Explicit Address String (Always Visible) */}
                                                                <span className="text-[10px] text-zinc-500 font-mono leading-none">
                                                                    {formattedAddress}
                                                                </span>

                                                                {entry.streak > 0 && (
                                                                    <span className="text-[10px] text-orange-500 font-mono flex items-center gap-0.5 mt-0.5">
                                                                        🔥 {entry.streak}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })()
                                            )}

                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="flex flex-col items-end">
                                        <span className={`font-mono font-bold ${i < 3 ? "text-[#0052FF] text-lg" : "text-zinc-400 text-sm"}`}>
                                            {typeof entry.score === 'object' ? entry.score.score : entry.score}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => setSelectedPlayer(entry)}
                                        className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                                    >
                                        ℹ️
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

            </div>
            <PlayerDetailModal
                isOpen={!!selectedPlayer}
                onClose={() => setSelectedPlayer(null)}
                player={selectedPlayer}
            />
        </div>
    );
}
