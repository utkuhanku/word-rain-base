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

    // Check Persistent Payment Flag (Server + Local Fallback)
    useEffect(() => {
        if (!address) return;
        const checkAccess = async () => {
            try {
                // 1. Check Local First (Instant)
                const payKey = `ethdenver_entry_paid_${address}`;
                if (localStorage.getItem(payKey) === 'true') {
                    setHasPaidEntry(true);
                }

                // 2. Check Server (Authoritative)
                const res = await fetch(`/api/event/access?address=${address}`);
                if (res.ok) {
                    const { hasAccess } = await res.json();
                    if (hasAccess) {
                        setHasPaidEntry(true);
                        localStorage.setItem(payKey, 'true'); // Re-sync local
                    }
                }
            } catch (e) {
                console.error("Access check failed", e);
            }
        };
        checkAccess();
    }, [address]);

    // Load Leaderboard (ETHDenver Partition)
    useEffect(() => {
        const loadLeaderboard = async () => {
            setIsRefreshing(true);
            try {
                // Fetch from new centralized API
                const res = await fetch(`/api/leaderboard/top?limit=50&partition=ethdenver&_t=${Date.now()}`, {
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

                // SAVE PERSISTENT STATE
                await fetch('/api/event/access', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ address }),
                });

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

                {/* Rankings - PREMIUM REDESIGN (TOP 4 PODIUM) */}
                <div className="space-y-6 pb-20">
                    {leaderboard.length === 0 ? (
                        <div className="text-center py-20 border border-dashed border-white/5 rounded-3xl bg-white/5 mx-6">
                            <p className="text-zinc-500 font-mono text-xs uppercase tracking-widest animate-pulse">Waiting for Players...</p>
                        </div>
                    ) : (
                        <>
                            {/* TOP 4 PODIUM GRID */}
                            <div className="grid grid-cols-2 gap-3 px-1">
                                {/* RANK 1 (Gold - Full Width/Big) */}
                                {leaderboard[0] && (
                                    <div
                                        onClick={() => setSelectedPlayer(leaderboard[0])}
                                        className="col-span-2 flex flex-col items-center gap-2 bg-gradient-to-b from-yellow-500/10 to-transparent p-4 rounded-3xl border border-yellow-500/30 cursor-pointer hover:bg-yellow-500/20 active:scale-[0.98] transition-all"
                                    >
                                        <div className="relative group">
                                            <div className="absolute inset-0 bg-yellow-500/30 blur-2xl rounded-full group-hover:bg-yellow-500/40 transition-all animate-pulse"></div>
                                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-2xl animate-bounce">👑</div>
                                            <img
                                                src={leaderboard[0].pfp_url || `https://raw.githubusercontent.com/base-org/brand-kit/main/logo/symbol/Base_Symbol_Blue.svg`}
                                                className="w-20 h-20 rounded-2xl border-4 border-yellow-500 relative z-10 object-cover shadow-[0_0_30px_rgba(234,179,8,0.3)] bg-white/5 p-2"
                                            />
                                            <div className="absolute -bottom-3 -right-3 bg-yellow-500 text-black w-8 h-8 flex items-center justify-center rounded-full text-base font-black border-2 border-white z-20 shadow-lg">1</div>
                                        </div>
                                        <div className="text-center mt-1">
                                            <div className="flex items-center justify-center gap-1">
                                                <span className="text-white font-black text-lg max-w-[150px] whitespace-nowrap overflow-hidden">
                                                    {leaderboard[0].username ? (
                                                        leaderboard[0].username
                                                    ) : leaderboard[0].type === 'wallet' || leaderboard[0].identifier?.startsWith('0x') ? (
                                                        <Name address={leaderboard[0].identifier as `0x${string}`} />
                                                    ) : (
                                                        leaderboard[0].displayName || `Pilot ${leaderboard[0].identifier?.slice(0, 4)}`
                                                    )}
                                                </span>
                                                {leaderboard[0].power_badge && <span className="text-[#855DCD]" title="Power User">⚡</span>}
                                            </div>
                                            <div className="text-yellow-500 text-sm font-mono font-bold tracking-wider">{leaderboard[0].score} PTS</div>
                                        </div>
                                    </div>
                                )}

                                {/* RANK 2 (Silver) */}
                                {leaderboard[1] && (
                                    <div
                                        onClick={() => setSelectedPlayer(leaderboard[1])}
                                        className="flex flex-col items-center gap-2 p-3 bg-zinc-400/5 rounded-2xl border border-zinc-400/20 cursor-pointer hover:bg-zinc-400/10 active:scale-[0.98] transition-all"
                                    >
                                        <div className="relative group">
                                            <img
                                                src={leaderboard[1].pfp_url || `https://raw.githubusercontent.com/base-org/brand-kit/main/logo/symbol/Base_Symbol_Blue.svg`}
                                                className="w-14 h-14 rounded-xl border-2 border-zinc-400 relative z-10 object-cover bg-white/5 p-1.5"
                                            />
                                            <div className="absolute -bottom-2 -right-2 bg-zinc-300 text-black w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold border border-zinc-500 z-20">2</div>
                                        </div>
                                        <div className="text-center">
                                            <span className="text-white font-bold text-xs max-w-[80px] block whitespace-nowrap overflow-hidden text-center">
                                                {leaderboard[1].username ? (
                                                    leaderboard[1].username
                                                ) : leaderboard[1].type === 'wallet' || leaderboard[1].identifier?.startsWith('0x') ? (
                                                    <Name address={leaderboard[1].identifier as `0x${string}`} />
                                                ) : (
                                                    leaderboard[1].displayName || `Pilot ${leaderboard[1].identifier?.slice(0, 4)}`
                                                )}
                                            </span>
                                            <div className="text-zinc-400 text-[10px] font-mono">{leaderboard[1].score}</div>
                                        </div>
                                    </div>
                                )}

                                {/* RANK 3 (Bronze) */}
                                {leaderboard[2] && (
                                    <div
                                        onClick={() => setSelectedPlayer(leaderboard[2])}
                                        className="flex flex-col items-center gap-2 p-3 bg-orange-700/5 rounded-2xl border border-orange-700/20 cursor-pointer hover:bg-orange-700/10 active:scale-[0.98] transition-all"
                                    >
                                        <div className="relative group">
                                            <img
                                                src={leaderboard[2].pfp_url || `https://raw.githubusercontent.com/base-org/brand-kit/main/logo/symbol/Base_Symbol_Blue.svg`}
                                                className="w-14 h-14 rounded-xl border-2 border-orange-700 relative z-10 object-cover bg-white/5 p-1.5"
                                            />
                                            <div className="absolute -bottom-2 -right-2 bg-orange-600 text-black w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold border border-orange-800 z-20">3</div>
                                        </div>
                                        <div className="text-center">
                                            <span className="text-white font-bold text-xs max-w-[80px] block whitespace-nowrap overflow-hidden text-center">
                                                {leaderboard[2].username ? (
                                                    leaderboard[2].username
                                                ) : leaderboard[2].type === 'wallet' || leaderboard[2].identifier?.startsWith('0x') ? (
                                                    <Name address={leaderboard[2].identifier as `0x${string}`} />
                                                ) : (
                                                    leaderboard[2].displayName || `Pilot ${leaderboard[2].identifier?.slice(0, 4)}`
                                                )}
                                            </span>
                                            <div className="text-orange-600 text-[10px] font-mono">{leaderboard[2].score}</div>
                                        </div>
                                    </div>
                                )}

                                {/* RANK 4 (Iron/Runner Up - NEW) */}
                                {leaderboard[3] && (
                                    <div
                                        onClick={() => setSelectedPlayer(leaderboard[3])}
                                        className="col-span-2 flex items-center justify-between p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20 mt-1 cursor-pointer hover:bg-blue-500/20 active:scale-[0.98] transition-all"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="relative">
                                                <img
                                                    src={leaderboard[3].pfp_url || `https://raw.githubusercontent.com/base-org/brand-kit/main/logo/symbol/Base_Symbol_Blue.svg`}
                                                    className="w-12 h-12 rounded-xl border-2 border-blue-500/50 object-cover bg-white/5 p-1"
                                                />
                                                <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold border border-blue-800">4</div>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-white font-bold text-sm max-w-[120px] whitespace-nowrap overflow-hidden">
                                                    {leaderboard[3].username ? (
                                                        leaderboard[3].username
                                                    ) : leaderboard[3].type === 'wallet' || leaderboard[3].identifier?.startsWith('0x') ? (
                                                        <Name address={leaderboard[3].identifier as `0x${string}`} />
                                                    ) : (
                                                        leaderboard[3].displayName || `Pilot ${leaderboard[3].identifier?.slice(0, 4)}`
                                                    )}
                                                </span>
                                                <span className="text-blue-400 text-[10px] uppercase font-bold tracking-wider">Runner Up</span>
                                            </div>
                                        </div>
                                        <div className="text-blue-400 font-mono font-bold text-sm">{leaderboard[3].score}</div>
                                    </div>
                                )}
                            </div>

                            {/* THE REST (Rank 5+) */}
                            <div className="space-y-1 mt-6 bg-white/5 rounded-2xl p-2 border border-white/5">
                                {leaderboard.slice(4).map((entry: any, i) => (
                                    <div
                                        key={entry.member || entry.address}
                                        onClick={() => setSelectedPlayer(entry)}
                                        className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-all cursor-pointer group active:scale-[0.98]"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="font-mono text-zinc-600 text-[10px] w-4 text-center">{i + 5}</span>

                                            <div className="relative">
                                                <img
                                                    src={entry.pfp_url || `https://raw.githubusercontent.com/base-org/brand-kit/main/logo/symbol/Base_Symbol_Blue.svg`}
                                                    className="w-8 h-8 rounded-full bg-zinc-800 object-cover border border-white/5 p-1"
                                                />
                                                {entry.active_status === 'active' && <div className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border border-black"></div>}
                                            </div>

                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-white font-bold text-xs max-w-[120px] whitespace-nowrap overflow-hidden">
                                                        {entry.username ? (
                                                            entry.username
                                                        ) : entry.type === 'wallet' || entry.identifier?.startsWith('0x') ? (
                                                            <Name address={entry.identifier as `0x${string}`} />
                                                        ) : (
                                                            entry.displayName || `Pilot ${entry.identifier?.slice(0, 4)}`
                                                        )}
                                                    </span>
                                                    {entry.power_badge && <span className="text-[10px]">⚡</span>}
                                                </div>
                                                {entry.streak > 0 && <span className="text-[9px] text-orange-500 font-mono">🔥 {entry.streak} Day Streak</span>}
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <span className="text-white font-mono font-bold text-sm block">{entry.score}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
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
