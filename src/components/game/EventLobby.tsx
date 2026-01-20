"use client";

import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { useState, useEffect } from "react";
import { useGameStore } from "@/lib/store/gameStore";
import { motion } from "framer-motion";
import { parseAbiItem } from "viem";

export default function EventLobby({ onBack, onStart }: { onBack: () => void, onStart: () => void }) {
    const { address } = useAccount();
    const { setMode } = useGameStore();
    const { writeContractAsync } = useWriteContract();
    const publicClient = usePublicClient();

    const [timeLeft, setTimeLeft] = useState<{ type: 'START' | 'END', hours: number, minutes: number, seconds: number } | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [hasPaidEntry, setHasPaidEntry] = useState(false);

    // Check local payment status & Migrate Local Scores
    useEffect(() => {
        if (address) {
            // 1. Direct Flag Check
            const isPaid = localStorage.getItem(`event_entry_paid_${address}`);
            if (isPaid === 'true') {
                setHasPaidEntry(true);
            }

            // 2. Fallback: If user has a score in leaderboard, they MUST have paid.
            try {
                const storedBoard = localStorage.getItem('event_leaderboard_live_v1');
                if (storedBoard) {
                    const data = JSON.parse(storedBoard);

                    // Check loosely (lowercase) to be safe
                    const myEntry = data.find((entry: any) => entry.address.toLowerCase() === address.toLowerCase());

                    if (myEntry) {
                        setHasPaidEntry(true);
                        localStorage.setItem(`event_entry_paid_${address}`, 'true');

                        // 3. AUTO-MIGRATE TO GLOBAL (One Time)
                        const hasSynced = localStorage.getItem(`event_legacy_synced_v2_${address}`);
                        if (!hasSynced && myEntry.score > 0) {
                            console.log("Migrating local score to global...", myEntry.score);
                            fetch('/api/event/submit', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ address: address, score: myEntry.score })
                            }).then((res) => {
                                if (res.ok) {
                                    localStorage.setItem(`event_legacy_synced_v2_${address}`, 'true');
                                    console.log("Migration Success");
                                } else {
                                    console.error("Migration Server Error");
                                }
                            }).catch(e => console.error("Migration Network Error", e));
                        }
                    }
                }
            } catch (e) { console.error(e); }
        }
    }, [address]);

    const [leaderboard, setLeaderboard] = useState<any[]>([]);

    // Load GLOBAL Leaderboard
    useEffect(() => {
        const loadLeaderboard = async () => {
            try {
                const res = await fetch('/api/event/leaderboard');
                if (!res.ok) return;
                const data = await res.json();

                let parsed: { address: string; score: number }[] = [];
                if (Array.isArray(data)) {
                    // Handle Vercel KV response formats
                    if (data.length > 0 && typeof data[1] === 'number') {
                        // Flat array: [member, score, member, score...]
                        for (let i = 0; i < data.length; i += 2) {
                            parsed.push({ address: data[i], score: data[i + 1] });
                        }
                    } else {
                        // Object array: [{ member: '...', score: ... }]
                        parsed = data.map((item: any) => ({
                            address: typeof item === 'string' ? item : item.member, // Fallback if member is string directly in list (rare)
                            score: item.score
                        }));
                    }
                }

                // Assign ranks & prizes
                const ranked = parsed.map((item: any, index: number) => ({
                    ...item,
                    rank: index + 1,
                    prize: index === 0 ? "$50" : index === 1 ? "$30" : index === 2 ? "$20" : "-"
                }));
                setLeaderboard(ranked);
            } catch (e) { console.error("Global Board Load Failed", e) }
        };

        loadLeaderboard();
        const interval = setInterval(loadLeaderboard, 5000); // 5s polling
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const calculateTime = () => {
            const now = new Date();
            // TSI is UTC+3. 
            // We need to target 20:00 UTC+3.
            // 20:00 UTC+3 is 17:00 UTC.

            const targetStart = new Date();
            // Target: 23:00 TSI (11 PM) = 20:00 UTC
            targetStart.setUTCHours(20, 0, 0, 0);

            // If now is past start time, check if event is active (within 48h)
            const eventDurationMs = 48 * 60 * 60 * 1000;
            const targetEnd = new Date(targetStart.getTime() + eventDurationMs);

            const nowMs = now.getTime();

            if (nowMs < targetStart.getTime()) {
                // Counting down to start
                const diff = targetStart.getTime() - nowMs;
                setTimeLeft({ type: 'START', hours: Math.floor(diff / 36e5), minutes: Math.floor((diff % 36e5) / 6e4), seconds: Math.floor((diff % 6e4) / 1000) });
            } else if (nowMs < targetEnd.getTime()) {
                // Event is active, counting down to end
                const diff = targetEnd.getTime() - nowMs;
                setTimeLeft({ type: 'END', hours: Math.floor(diff / 36e5), minutes: Math.floor((diff % 36e5) / 6e4), seconds: Math.floor((diff % 6e4) / 1000) });
            } else {
                // Event ended
                setTimeLeft(null);
            }
        };

        calculateTime();
        const interval = setInterval(calculateTime, 1000);
        return () => clearInterval(interval);
    }, []);

    const handleEntryPayment = async () => {
        if (!address) return;

        // SKIP PAYMENT IF ALREADY PAID
        if (hasPaidEntry) {
            setMode('EVENT');
            onStart();
            return;
        }

        setIsProcessing(true);
        try {
            // 1 USDC Entry Fee
            const ENTRY_FEE = BigInt(1000000);
            const TREASURY = "0x6edd22E9792132614dD487aC6434dec3709b79A8";

            const hash = await writeContractAsync({
                address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base USDC
                abi: [parseAbiItem('function transfer(address to, uint256 value)')],
                functionName: 'transfer',
                args: [TREASURY, ENTRY_FEE]
            });

            if (publicClient) {
                await publicClient.waitForTransactionReceipt({ hash });
                console.log("Entry Paid");

                // SAVE LOCAL STATE
                localStorage.setItem(`event_entry_paid_${address}`, 'true');
                setHasPaidEntry(true);

                setMode('EVENT'); // Active Event Mode
                onStart(); // Start Game
            }
        } catch (e) {
            console.error("Entry Failed", e);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="w-full max-w-md mx-auto h-[100dvh] bg-black text-white font-mono flex flex-col relative overflow-hidden">
            {/* Background Effects specifically for Event (Purple/Pink Glitch Theme) */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-[#D900FF]/20 blur-[120px] rounded-full animate-pulse"></div>
                <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-[#00FF9D]/10 blur-[120px] rounded-full animate-pulse delay-1000"></div>
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
            </div>

            {/* Header */}
            <div className="relative z-10 flex items-center justify-between p-6 border-b border-zinc-800/50 backdrop-blur-md">
                <button
                    onClick={onBack}
                    className="w-10 h-10 flex items-center justify-center border border-zinc-700 bg-black/50 hover:bg-zinc-800 transition-all rounded-full"
                >
                    <span className="text-xl">←</span>
                </button>
                <div className="flex flex-col items-center">
                    <h1 className="text-xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-[#D900FF] to-[#00FF9D]">
                        FLASH EVENT
                    </h1>
                    <span className="text-[10px] text-zinc-500 tracking-[0.2em] uppercase">LIMITED TIME</span>
                </div>
                <div className="w-10"></div> {/* Spacer */}
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-6 relative z-10 scrollbar-hide space-y-8">

                {/* Timer Section */}
                <div className="flex flex-col items-center justify-center p-6 border border-zinc-800 bg-zinc-900/30 rounded-2xl backdrop-blur-sm shadow-xl">
                    {timeLeft ? (
                        <>
                            <span className="text-[10px] text-zinc-400 uppercase tracking-widest mb-2">
                                {timeLeft.type === 'START' ? 'EVENT STARTS IN' : 'TIME REMAINING'}
                            </span>
                            <div className="flex items-baseline gap-2">
                                <span className="text-4xl md:text-5xl font-bold font-[Geist] text-white tabular-nums">
                                    {String(timeLeft.hours).padStart(2, '0')}
                                </span>
                                <span className="text-sm text-zinc-600">H</span>
                                <span className="text-4xl md:text-5xl font-bold font-[Geist] text-white tabular-nums">
                                    {String(timeLeft.minutes).padStart(2, '0')}
                                </span>
                                <span className="text-sm text-zinc-600">M</span>
                                <span className="text-4xl md:text-5xl font-bold font-[Geist] text-white tabular-nums">
                                    {String(timeLeft.seconds).padStart(2, '0')}
                                </span>
                                <span className="text-sm text-zinc-600">S</span>
                            </div>
                        </>
                    ) : (
                        <span className="text-xl font-bold text-zinc-500">EVENT ENDED</span>
                    )}
                </div>

                {/* Event Info / Rules */}
                <div className="p-5 rounded-xl border border-[#D900FF]/20 bg-[#D900FF]/5 backdrop-blur-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-20">
                        <svg width="60" height="60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" fill="#D900FF" stroke="#D900FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                    <h3 className="text-xs font-bold text-[#D900FF] uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span>⚡️</span> MISSION BRIEFING
                    </h3>
                    <ul className="text-[10px] text-zinc-300 space-y-3 font-mono leading-relaxed relative z-10">
                        <li className="flex items-start gap-2">
                            <span className="text-[#00FF9D] mt-0.5">▸</span>
                            <span><strong>STATUS:</strong> Protocol activates at <strong className="text-white">23:00 (11 PM)</strong>.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-[#00FF9D] mt-0.5">▸</span>
                            <span><strong className="text-white">1 USDC</strong> initializes the connection. One-time fee.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-[#00FF9D] mt-0.5">▸</span>
                            <span><strong>MISSION:</strong> <strong className="text-white">48 Hours</strong> to dominate the leaderboard.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-[#00FF9D] mt-0.5">▸</span>
                            <span><strong>BOUNTY:</strong> Top 3 Agents split the <strong className="text-[#D900FF]">$100 USDC Pool</strong>.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-[#00FF9D] mt-0.5">▸</span>
                            <span><strong>INTEL:</strong> Your highest score is <strong className="text-white">Auto-Saved</strong> (Free). Unlimited Revives available.</span>
                        </li>
                    </ul>
                </div>

                {/* Prize Pool Banner */}
                <div className="relative overflow-hidden rounded-xl border border-[#D900FF]/30 p-6 flex flex-col items-center text-center group hover:border-[#D900FF]/50 transition-all">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#D900FF]/10 to-transparent"></div>
                    <div className="relative z-10">
                        <div className="text-xs text-[#D900FF] font-bold tracking-widest mb-1.5">TOTAL PRIZE POOL</div>
                        <div className="text-5xl font-black text-white tracking-tighter drop-shadow-[0_0_15px_rgba(217,0,255,0.6)]">
                            $100
                        </div>
                        <div className="mt-5 grid grid-cols-3 gap-3 w-full text-[10px]">
                            <div className="bg-black/60 p-2 rounded border border-[#D900FF]/20 flex flex-col items-center">
                                <div className="text-[#FFD700] font-bold mb-1">🥇 1ST</div>
                                <div className="font-bold text-white text-lg">$50</div>
                            </div>
                            <div className="bg-black/60 p-2 rounded border border-[#D900FF]/20 flex flex-col items-center">
                                <div className="text-[#C0C0C0] font-bold mb-1">🥈 2ND</div>
                                <div className="font-bold text-white text-lg">$30</div>
                            </div>
                            <div className="bg-black/60 p-2 rounded border border-[#D900FF]/20 flex flex-col items-center">
                                <div className="text-[#CD7F32] font-bold mb-1">🥉 3RD</div>
                                <div className="font-bold text-white text-lg">$20</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Action Button */}
                {timeLeft?.type === 'END' && (
                    <motion.button
                        whileHover={{ scale: 1.02, boxShadow: "0 0 30px rgba(217,0,255,0.4)" }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleEntryPayment}
                        disabled={isProcessing}
                        className="w-full py-5 bg-gradient-to-r from-[#D900FF] to-[#b300dB] text-black font-black text-xl uppercase tracking-widest rounded-xl relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(217,0,255,0.3)]"
                    >
                        <span className="relative z-10 flex items-center justify-center gap-3">
                            {isProcessing ? "INITIALIZING..." : (hasPaidEntry ? "START MISSION" : "ENTER EVENT")}
                            {!hasPaidEntry && <span className="bg-black/20 px-2.5 py-1 rounded text-sm font-mono tracking-wider text-white/90">1 USDC</span>}
                        </span>
                        <div className="absolute inset-0 bg-white/30 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                    </motion.button>
                )}

                {timeLeft?.type === 'START' && (
                    <div className="w-full py-4 text-center text-zinc-500 font-mono text-xs uppercase tracking-widest border border-zinc-800 rounded-xl">
                        WAIT FOR START
                    </div>
                )}


                {/* Event Leaderboard */}
                <div className="pt-4">
                    <div className="flex items-center justify-between mb-4 px-1">
                        <h2 className="text-sm font-bold text-white tracking-wider flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#00FF9D] animate-pulse"></span>
                            LIVE STANDINGS
                        </h2>
                        <span className="text-[10px] text-zinc-500 font-mono">UPDATES LIVE</span>
                    </div>

                    <div className="space-y-2.5">
                        {leaderboard.length === 0 ? (
                            <div className="text-center py-12 border border-dashed border-zinc-800 rounded-xl bg-black/20 flex flex-col items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center text-xl grayscale opacity-50">🏆</div>
                                <div>
                                    <p className="text-zinc-500 text-xs font-mono uppercase tracking-widest mb-1">No Records Yet</p>
                                    <p className="text-zinc-700 text-[10px]">Be the first to claim the throne.</p>
                                </div>
                            </div>
                        ) : (
                            leaderboard.map((entry) => (
                                <div key={entry.rank} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${entry.rank <= 3 ? 'border-[#D900FF]/30 bg-gradient-to-r from-[#D900FF]/10 to-transparent' : 'border-zinc-800 bg-black/40'
                                    }`}>
                                    <div className="flex items-center gap-4">
                                        <div className={`w-8 h-8 flex items-center justify-center text-sm font-black rounded-lg ${entry.rank === 1 ? 'bg-[#FFD700] text-black shadow-[0_0_10px_#FFD700]' :
                                            entry.rank === 2 ? 'bg-[#C0C0C0] text-black' :
                                                entry.rank === 3 ? 'bg-[#CD7F32] text-black' :
                                                    'text-zinc-500 bg-zinc-900'
                                            }`}>
                                            {entry.rank}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-xs font-mono text-zinc-300 tracking-wide">
                                                {entry.address.length > 15 ? `${entry.address.slice(0, 6)}...${entry.address.slice(-4)}` : entry.address}
                                            </span>
                                            {entry.rank <= 3 && <span className="text-[9px] text-[#D900FF] font-black tracking-widest">LEADER</span>}
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="font-black text-xl text-white tabular-nums tracking-tight">{entry.score}</span>
                                        {entry.prize !== '-' && (
                                            <span className="text-[10px] text-[#00FF9D] font-mono font-bold bg-[#00FF9D]/10 px-1.5 rounded">{entry.prize} POOL</span>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
