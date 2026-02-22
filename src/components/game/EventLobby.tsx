"use client";

import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { useState, useEffect } from "react";
import { useGameStore } from "@/lib/store/gameStore";
import { motion } from "framer-motion";
import { parseAbiItem } from "viem";
import { Identity, Avatar, Name, Address } from '@coinbase/onchainkit/identity';
import PlayerDetailModal from './PlayerDetailModal';

// --- Countdown Component ---
const CountdownTimer = ({ targetDate }: { targetDate: Date }) => {
    const [timeLeft, setTimeLeft] = useState({ d: 0, h: 0, m: 0, s: 0 });

    useEffect(() => {
        const timer = setInterval(() => {
            const difference = targetDate.getTime() - new Date().getTime();
            if (difference > 0) {
                setTimeLeft({
                    d: Math.floor(difference / (1000 * 60 * 60 * 24)),
                    h: Math.floor((difference / (1000 * 60 * 60)) % 24),
                    m: Math.floor((difference / 1000 / 60) % 60),
                    s: Math.floor((difference / 1000) % 60)
                });
            } else {
                setTimeLeft({ d: 0, h: 0, m: 0, s: 0 });
            }
        }, 1000);
        return () => clearInterval(timer);
    }, [targetDate]);

    return (
        <div className="flex justify-center items-center gap-3">
            <div className="flex flex-col items-center">
                <span className="text-xl font-bold text-white tracking-tight">{timeLeft.d.toString().padStart(2, '0')}</span>
                <span className="text-[7px] text-zinc-500 font-mono tracking-widest uppercase mt-1">Days</span>
            </div>
            <span className="text-zinc-800 pb-3 font-mono text-sm">:</span>
            <div className="flex flex-col items-center">
                <span className="text-xl font-bold text-white tracking-tight">{timeLeft.h.toString().padStart(2, '0')}</span>
                <span className="text-[7px] text-zinc-500 font-mono tracking-widest uppercase mt-1">Hrs</span>
            </div>
            <span className="text-zinc-800 pb-3 font-mono text-sm">:</span>
            <div className="flex flex-col items-center">
                <span className="text-xl font-bold text-white tracking-tight">{timeLeft.m.toString().padStart(2, '0')}</span>
                <span className="text-[7px] text-zinc-500 font-mono tracking-widest uppercase mt-1">Min</span>
            </div>
            <span className="text-zinc-800 pb-3 font-mono text-sm">:</span>
            <div className="flex flex-col items-center">
                <span className="text-xl font-bold text-[#3B82F6] tracking-tight">{timeLeft.s.toString().padStart(2, '0')}</span>
                <span className="text-[7px] text-[#3B82F6]/70 font-mono tracking-widest uppercase mt-1">Sec</span>
            </div>
        </div>
    );
};
// ----------------------------

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

            {/* Countdown Banner */}
            <div className="w-full flex justify-center py-6 border-b border-white/5 relative bg-[#0A0A0A] overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-[#3B82F6]/5 to-transparent pointer-events-none" />
                <div className="flex flex-col items-center relative z-10">
                    <span className="text-[9px] text-[#3B82F6] font-bold tracking-[0.3em] uppercase mb-4">EVENT CONCLUDES IN</span>
                    <CountdownTimer targetDate={new Date('2026-02-23T00:00:00Z')} />
                    <span className="text-[8px] text-zinc-600 tracking-widest uppercase mt-4">Ends UTC 22 FEB MIDNIGHT</span>
                </div>
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
                            {/* TOP 3 PODIUM - SLEEK DESIGN */}
                            <div className="flex flex-col gap-4">
                                {/* RANK 1 (Gold) */}
                                {leaderboard[0] && (
                                    <div
                                        onClick={() => setSelectedPlayer(leaderboard[0])}
                                        className="w-full flex items-center justify-between bg-gradient-to-r from-[#D4AF37]/20 via-[#0A0A0A] to-[#0A0A0A] p-4 rounded-2xl border border-[#D4AF37]/30 cursor-pointer hover:bg-white/5 active:scale-[0.98] transition-all group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="text-[#D4AF37] font-black text-2xl italic tracking-tighter w-8 text-center drop-shadow-[0_0_10px_rgba(212,175,55,0.8)]">1</div>
                                            <div className="relative">
                                                <div className="absolute inset-0 bg-[#D4AF37] blur-md rounded-full opacity-40 group-hover:opacity-70 transition-opacity"></div>
                                                <img
                                                    src={leaderboard[0].pfp_url || '/base-logo.svg'}
                                                    onError={(e) => { e.currentTarget.src = '/base-logo.svg'; }}
                                                    className="w-16 h-16 rounded-full border border-[#D4AF37] relative z-10 object-cover bg-black"
                                                    alt="pfp"
                                                />
                                            </div>
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-white font-bold text-lg max-w-[150px] whitespace-nowrap overflow-hidden">
                                                        {leaderboard[0].username ? leaderboard[0].username : leaderboard[0].type === 'wallet' || leaderboard[0].identifier?.startsWith('0x') ? <Name address={leaderboard[0].identifier as `0x${string}`} /> : (leaderboard[0].displayName || `Pilot ${leaderboard[0].identifier?.slice(0, 4)}`)}
                                                    </span>
                                                    {leaderboard[0].power_badge && <span className="text-[#D4AF37] text-xs">⚡</span>}
                                                </div>
                                                <span className="text-[#D4AF37] text-[10px] font-mono tracking-widest uppercase">CHAMPION</span>
                                            </div>
                                        </div>
                                        <div className="text-[#D4AF37] font-space font-black text-2xl tracking-tighter">{leaderboard[0].score}</div>
                                    </div>
                                )}

                                {/* RANK 2 (Silver) & RANK 3 (Bronze) Grid */}
                                <div className="grid grid-cols-2 gap-3">
                                    {/* RANK 2 */}
                                    {leaderboard[1] && (
                                        <div
                                            onClick={() => setSelectedPlayer(leaderboard[1])}
                                            className="flex flex-col items-center bg-gradient-to-b from-[#C0C0C0]/10 to-transparent p-4 rounded-2xl border border-[#C0C0C0]/20 cursor-pointer hover:bg-white/5 active:scale-[0.98] transition-all group relative overflow-hidden"
                                        >
                                            <div className="absolute top-3 left-3 text-[#C0C0C0] font-black italic tracking-tighter">2</div>
                                            <img
                                                src={leaderboard[1].pfp_url || '/base-logo.svg'}
                                                onError={(e) => { e.currentTarget.src = '/base-logo.svg'; }}
                                                className="w-12 h-12 rounded-full border border-[#C0C0C0]/50 object-cover bg-black mt-2 mb-3 shadow-[0_0_15px_rgba(192,192,192,0.2)]"
                                                alt="pfp"
                                            />
                                            <span className="text-white font-bold text-sm max-w-[100px] whitespace-nowrap overflow-hidden">
                                                {leaderboard[1].username ? leaderboard[1].username : leaderboard[1].type === 'wallet' || leaderboard[1].identifier?.startsWith('0x') ? <Name address={leaderboard[1].identifier as `0x${string}`} /> : (leaderboard[1].displayName || `Pilot`)}
                                            </span>
                                            <div className="text-[#C0C0C0] font-space font-bold mt-1">{leaderboard[1].score}</div>
                                        </div>
                                    )}

                                    {/* RANK 3 */}
                                    {leaderboard[2] && (
                                        <div
                                            onClick={() => setSelectedPlayer(leaderboard[2])}
                                            className="flex flex-col items-center bg-gradient-to-b from-[#CD7F32]/10 to-transparent p-4 rounded-2xl border border-[#CD7F32]/20 cursor-pointer hover:bg-white/5 active:scale-[0.98] transition-all group relative overflow-hidden"
                                        >
                                            <div className="absolute top-3 left-3 text-[#CD7F32] font-black italic tracking-tighter">3</div>
                                            <img
                                                src={leaderboard[2].pfp_url || '/base-logo.svg'}
                                                onError={(e) => { e.currentTarget.src = '/base-logo.svg'; }}
                                                className="w-12 h-12 rounded-full border border-[#CD7F32]/50 object-cover bg-black mt-2 mb-3 shadow-[0_0_15px_rgba(205,127,50,0.2)]"
                                                alt="pfp"
                                            />
                                            <span className="text-white font-bold text-sm max-w-[100px] whitespace-nowrap overflow-hidden">
                                                {leaderboard[2].username ? leaderboard[2].username : leaderboard[2].type === 'wallet' || leaderboard[2].identifier?.startsWith('0x') ? <Name address={leaderboard[2].identifier as `0x${string}`} /> : (leaderboard[2].displayName || `Pilot`)}
                                            </span>
                                            <div className="text-[#CD7F32] font-space font-bold mt-1">{leaderboard[2].score}</div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* THE REST (Rank 4+) */}
                            <div className="space-y-1 mt-6">
                                {leaderboard.slice(3).map((entry: any, i) => (
                                    <div
                                        key={entry.member || entry.address}
                                        onClick={() => setSelectedPlayer(entry)}
                                        className="flex items-center justify-between p-4 rounded-xl hover:bg-white/5 transition-all cursor-pointer group active:scale-[0.98] bg-[#0A0A0A] border border-white/5"
                                    >
                                        <div className="flex items-center gap-4">
                                            <span className="font-space text-zinc-600 text-sm font-bold w-6 text-center">{i + 4}</span>

                                            <div className="relative">
                                                <div className="w-full h-full bg-zinc-800 flex items-center justify-center rounded-full text-[10px] text-zinc-500 font-mono border border-white/10">B</div>
                                            </div>

                                            <div className="flex flex-col justify-center">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-white font-bold text-sm max-w-[120px] whitespace-nowrap overflow-hidden">
                                                        {entry.username ? entry.username : entry.type === 'wallet' || entry.identifier?.startsWith('0x') ? <Name address={entry.identifier as `0x${string}`} /> : (entry.displayName || `Pilot ${entry.identifier?.slice(0, 4)}`)}
                                                    </span>
                                                    {entry.power_badge && <span className="text-[10px]">⚡</span>}
                                                </div>
                                                {entry.streak > 0 && <span className="text-[9px] text-orange-500 font-mono tracking-widest mt-0.5">🔥 {entry.streak} DAY</span>}
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <span className="text-white font-space font-bold text-lg group-hover:text-[#3B82F6] transition-colors">{entry.score}</span>
                                        </div>
                                    </div>
                                ))}

                                {/* DISQUALIFIED SECTION */}
                                <div className="mt-8 pt-6 border-t border-red-500/20">
                                    <div className="flex items-center gap-2 mb-3 px-2">
                                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                                        <h3 className="text-xs font-bold text-red-500 tracking-widest uppercase">Disqualified Players</h3>
                                    </div>

                                    <div className="flex flex-col gap-3">
                                        {[
                                            '0xe555eBCa692D41300773F488FDb92244AAf81Fa7',
                                            '0xB27F239610e47cACDfF082A79bE829384d46b976',
                                            '0x53481a207B5dd683a7C018157709A5092774b09A'
                                        ].map(blockedAddr => (
                                            <div key={blockedAddr} className="flex flex-col p-3 rounded-xl bg-red-950/30 border border-red-500/30 w-full relative overflow-hidden group">
                                                {/* Striped warning background */}
                                                <div className="absolute inset-0 opacity-10 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#ef4444_10px,#ef4444_20px)] pointer-events-none"></div>

                                                <div className="flex items-center justify-between relative z-10 w-full">
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-mono text-red-500/50 text-[10px] w-4 text-center">X</span>
                                                        <div className="relative">
                                                            <img
                                                                src={`/base-logo.svg`}
                                                                className="w-8 h-8 rounded-full bg-black/50 object-cover border border-red-500/30 p-1 opacity-50 grayscale"
                                                            />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-red-400 font-mono text-xs max-w-[140px] whitespace-nowrap overflow-hidden line-through decoration-red-500/50" title={blockedAddr}>
                                                                {blockedAddr.slice(0, 10)}...
                                                            </span>
                                                            <span className="text-[9px] text-red-500/70 font-mono uppercase tracking-wider mt-0.5">
                                                                Suspicious Activity
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="text-right">
                                                        <span className="text-red-500/50 font-mono font-bold text-sm block">0.00</span>
                                                    </div>
                                                </div>

                                                {/* Action Button */}
                                                <a
                                                    href="https://warpcast.com/utkus"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="mt-3 relative z-10 w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-bold tracking-widest uppercase rounded border border-red-500/20 flex items-center justify-center gap-2 transition-colors"
                                                >
                                                    <span>DM @UTKUS FOR INQUIRIES</span>
                                                    <span>→</span>
                                                </a>
                                            </div>
                                        ))}
                                    </div>
                                </div>
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
