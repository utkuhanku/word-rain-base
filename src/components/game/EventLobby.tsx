"use client";

import { useAccount, useWriteContract, usePublicClient, useSignMessage } from "wagmi";
import { useState, useEffect, useRef } from "react";
import { useGameStore } from "@/lib/store/gameStore";
import { motion } from "framer-motion";
import { parseAbiItem } from "viem";

export default function EventLobby({ onBack, onStart }: { onBack: () => void, onStart: () => void }) {
    const { address } = useAccount();
    const { setMode } = useGameStore();
    const { writeContractAsync } = useWriteContract();
    const { signMessageAsync } = useSignMessage(); // Signature Hook
    const publicClient = usePublicClient();

    const [timeLeft, setTimeLeft] = useState<{ type: 'START' | 'END', hours: number, minutes: number, seconds: number } | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [hasPaidEntry, setHasPaidEntry] = useState(false);
    const [participants, setParticipants] = useState<string[]>([]);

    const [isSyncing, setIsSyncing] = useState(false);

    // MANUAL SYNC (The "Payment-Free TX" Strategy)
    const handleManualSync = async () => {
        if (!address) return;
        setIsSyncing(true);
        try {
            // 1. Get Best Local Score
            const storedBoard = localStorage.getItem('event_leaderboard_live_v1');
            let bestLocal = 0;
            if (storedBoard) {
                const data = JSON.parse(storedBoard);
                const myEntries = data.filter((e: any) => e.address.toLowerCase() === address.toLowerCase());
                if (myEntries.length > 0) {
                    bestLocal = Math.max(...myEntries.map((e: any) => e.score));
                }
            }

            if (bestLocal === 0) {
                // Try to fallback to persisted paid flag check
                console.warn("No local score found in leaderboard array");
            }

            // 2. Sign Message (Free Interaction - Proof of Intent)
            const message = `Sync Word Rain Score: ${bestLocal}`;
            const signature = await signMessageAsync({ message });

            // 3. Post to Server (With Signature)
            const res = await fetch('/api/event/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address, score: bestLocal, signature })
            });

            if (res.ok) {
                console.log("Manual Sync Success");
                setRefreshTrigger(prev => prev + 1); // Refresh UI
            }
        } catch (e) {
            console.error("Manual Sync Failed", e);
        } finally {
            setIsSyncing(false);
        }
    };

    // 0. Fetch On-Chain Participants (The Truth: USDC Logs)
    useEffect(() => {
        if (!publicClient) return;
        const fetchOnChain = async () => {
            try {
                // Base USDC Contract
                const logs = await publicClient.getLogs({
                    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                    event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)'),
                    args: { to: "0x6edd22E9792132614dD487aC6434dec3709b79A8" }, // Treasury
                    fromBlock: BigInt(40000000) // Optimized: Start from ~40M (Jan 2026 approx)
                });
                const unique = Array.from(new Set(logs.map(l => l.args.from as string)));
                console.log("On-Chain Participants Found:", unique.length);
                setParticipants(unique);
            } catch (e) { console.error("Chain log failed", e); }
        };
        fetchOnChain();
        const interval = setInterval(fetchOnChain, 30000); // Poll every 30s
        return () => clearInterval(interval);
    }, [publicClient]);

    const [serverStatus, setServerStatus] = useState<'CONNECTING' | 'ONLINE' | 'ERROR'>('CONNECTING');
    const [debugInfo, setDebugInfo] = useState<string | null>(null);

    // NUCLEAR SYNC: Force push local scores to global every time component mounts or address changes
    useEffect(() => {
        if (!address) return;

        const runAggressiveSync = async () => {
            setIsSyncing(true);
            try {
                // 1. Check Local Payment Flag
                const isPaid = localStorage.getItem(`event_entry_paid_${address}`);
                if (isPaid === 'true') setHasPaidEntry(true);

                // 2. FORCE SYNC LOCAL SCORES
                const storedBoard = localStorage.getItem('event_leaderboard_final');
                if (storedBoard) {
                    const data = JSON.parse(storedBoard);
                    const myEntries = data.filter((entry: any) => entry.address.toLowerCase() === address.toLowerCase());

                    if (myEntries.length > 0) {
                        setHasPaidEntry(true); // If they have scores, they paid.
                        localStorage.setItem(`event_entry_paid_${address}`, 'true');

                        // Find absolute best local score
                        const bestLocal = Math.max(...myEntries.map((e: any) => e.score));

                        // FORCE POST TO SERVER
                        await fetch('/api/event/submit', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ address: address, score: bestLocal })
                        });
                        console.log("NUCLEAR SYNC: Pushed score", bestLocal);
                    }
                }
            } catch (e) {
                console.error("Sync Failed", e);
            } finally {
                setIsSyncing(false);
                setRefreshTrigger(p => p + 1); // Refresh leaderboard after sync
            }
        };

        runAggressiveSync();
    }, [address]);

    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Load Leaderboard (Hybrid: Local + Global)
    useEffect(() => {
        const loadLeaderboard = async () => {
            setIsRefreshing(true);
            let localData: any[] = [];

            // 1. Get Local Data (Instant Restore)
            try {
                const stored = localStorage.getItem('event_leaderboard_final');
                if (stored) {
                    localData = JSON.parse(stored);
                }

                // Render Local Data IMMEDIATELY
                if (localData.length > 0) {
                    // Temporary render while fetching global
                    const localRanked = [...localData].sort((a: any, b: any) => b.score - a.score).map((item, index) => ({
                        ...item,
                        rank: index + 1,
                        prize: index === 0 ? "$50" : index === 1 ? "$30" : index === 2 ? "$20" : "-"
                    }));
                    setLeaderboard((prev) => prev.length === 0 ? localRanked : prev);
                }
            } catch (e) { }

            // 2. Fetch Global Data (Background)
            try {
                // CACHE BUSTING: Add timestamp to force fresh fetch
                const res = await fetch(`/api/event/leaderboard?_t=${Date.now()}`, {
                    cache: 'no-store',
                    headers: { 'Pragma': 'no-cache' }
                });
                if (res.ok) {
                    setServerStatus('ONLINE'); // STATUS OK
                    setDebugInfo(null); // Clear errors
                    const data = await res.json();
                    console.log("[LEADERBOARD RAW]", data);

                    let globalParsed: { address: string; score: number }[] = [];

                    if (Array.isArray(data)) {
                        if (data.length > 0 && typeof data[1] === 'number') {
                            // Format: [user, score, user, score]
                            for (let i = 0; i < data.length; i += 2) {
                                globalParsed.push({ address: data[i], score: data[i + 1] });
                            }
                        } else {
                            // Format: [{ member: '...', score: ... }, ...]
                            globalParsed = data.map((item: any) => ({
                                address: typeof item === 'string' ? item : (item.member || item.value),
                                score: item.score
                            }));
                        }
                    }

                    // 3. Merge Strategies
                    const scoreMap = new Map();

                    // Add Global First (Base Truth)
                    globalParsed.forEach(p => {
                        if (p.address && typeof p.score === 'number') {
                            scoreMap.set(p.address.toLowerCase(), p.score);
                        }
                    });

                    // Merge Local (If we have a local score higher than global (or new), use it)
                    localData.forEach(localItem => {
                        const addr = localItem.address.toLowerCase();
                        const currentGlobal = scoreMap.get(addr) || 0;
                        if (localItem.score > currentGlobal) {
                            scoreMap.set(addr, localItem.score);
                        }
                    });

                    // Add On-Chain Participants (Pending)
                    participants.forEach(pAddr => {
                        const addr = pAddr.toLowerCase();
                        // Only add if NOT already in map (meaning they have no score yet)
                        if (!scoreMap.has(addr)) {
                            scoreMap.set(addr, { score: 0, isPending: true });
                        }
                    });

                    // Reconstruct Array
                    const merged = Array.from(scoreMap.entries()).map(([addr, val]: [string, any]) => {
                        if (typeof val === 'number') return { address: addr, score: val };
                        return { address: addr, score: val.score, isPending: val.isPending };
                    });

                    // Final Sort
                    merged.sort((a, b) => b.score - a.score);

                    const ranked = merged.map((item, index) => ({
                        ...item,
                        rank: index + 1,
                        prize: index === 0 ? "$50" : index === 1 ? "$30" : index === 2 ? "$20" : "-"
                    }));

                    setLeaderboard(ranked);
                } else {
                    setServerStatus('ERROR'); // STATUS ERROR
                    try {
                        const errData = await res.json();
                        if (errData.error === 'MISSING_ENV') {
                            setDebugInfo(`MISSING ENV: URL=${errData.details?.hasUrl}, TOKEN=${errData.details?.hasToken}`);
                        } else {
                            setDebugInfo(errData.message || `HTTP ${res.status}`);
                        }
                    } catch (e) {
                        setDebugInfo(`HTTP ${res.status}`);
                    }
                }
            } catch (e: any) {
                console.error("Global fetch failed", e);
                setServerStatus('ERROR'); // STATUS ERROR
                setDebugInfo(e.message || "Fetch Failed");
            } finally {
                setIsRefreshing(false);
            }
        };

        // Initial Load
        loadLeaderboard();

        // Poll
        const interval = setInterval(loadLeaderboard, 10000); // 10s polling
        return () => clearInterval(interval);
    }, [refreshTrigger, participants]);

    useEffect(() => {
        const calculateTime = () => {
            const now = new Date();

            // EXACT EVENT TIME: 20 Jan 23:00 TSI to 22 Jan 23:00 TSI
            // TSI = UTC+3
            // 20 Jan 23:00 TSI = 20 Jan 20:00 UTC
            const targetStart = new Date("2026-01-20T23:00:00+03:00");
            const targetEnd = new Date("2026-01-22T23:00:00+03:00"); // 48h Duration

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

    // Check Sync Status (Robust: Checks Final & Legacy)
    const myLocalScore = (() => {
        if (!address) return 0;
        try {
            // Check Final Key
            const storedFinal = localStorage.getItem('event_leaderboard_final');
            let maxFinal = 0;
            if (storedFinal) {
                const data = JSON.parse(storedFinal);
                const me = data.filter((d: any) => d.address.toLowerCase() === address.toLowerCase());
                if (me.length) maxFinal = Math.max(...me.map((d: any) => d.score));
            }

            // Check Legacy Key (Backup for old scores)
            const storedLegacy = localStorage.getItem('event_leaderboard_live_v1');
            let maxLegacy = 0;
            if (storedLegacy) {
                const data = JSON.parse(storedLegacy);
                const me = data.filter((d: any) => d.address.toLowerCase() === address.toLowerCase());
                if (me.length) maxLegacy = Math.max(...me.map((d: any) => d.score));
            }

            return Math.max(maxFinal, maxLegacy);
        } catch (e) { return 0; }
        return 0;
    })();

    // FAIL-SAFE DISPLAY MERGE: Guarantees user sees themselves
    const displayLeaderboard = (() => {
        let list = [...leaderboard];

        // 1. Force Updates for Self
        if (address && myLocalScore > 0) {
            const myIndex = list.findIndex(x => x.address.toLowerCase() === address.toLowerCase());

            if (myIndex > -1) {
                // Update existing if local is higher
                if (list[myIndex].score < myLocalScore) {
                    list[myIndex] = { ...list[myIndex], score: myLocalScore, isPending: false };
                }
            } else {
                // Insert Self if missing
                list.push({ address: address, score: myLocalScore, isPending: false });
            }
        }

        // 2. Re-Sort
        list.sort((a, b) => b.score - a.score);

        // 3. Re-Rank
        return list.map((item, index) => ({
            ...item,
            rank: index + 1,
            prize: index === 0 ? "$50" : index === 1 ? "$30" : index === 2 ? "$20" : "-"
        }));
    })();

    // Check if what we are displaying effectively matches local
    // Since we force display above, isUnsynced mainly tracks if the *Server* version (in leaderboard state) is outdated
    const serverEntry = leaderboard.find(e => e.address.toLowerCase() === address?.toLowerCase());
    const isUnsynced = myLocalScore > 0 && (!serverEntry || serverEntry.score < myLocalScore);

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


                {/* UNSYNCED WARNING BANNER */}
                {isUnsynced && !isSyncing && (
                    <div className="p-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <span className="text-xl">⚠️</span>
                            <div>
                                <p className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest leading-none mb-1">Upload Required</p>
                                <p className="text-[9px] text-zinc-400 font-mono">Local: <span className="text-white">{myLocalScore}</span> | Cloud: {serverEntry?.score || 0}</p>
                            </div>
                        </div>
                        <button
                            onClick={handleManualSync}
                            className="px-3 py-1.5 bg-yellow-500 hover:bg-yellow-400 text-black font-black text-[10px] uppercase tracking-widest rounded shadow-[0_0_10px_rgba(234,179,8,0.2)] active:scale-95 transition-all"
                        >
                            SYNC NOW
                        </button>
                    </div>
                )}

                {/* Event Leaderboard */}
                <div>
                    <div className="flex items-center justify-between mb-4 px-1">
                        <div className="flex items-center gap-3">
                            <h2 className="text-sm font-bold text-white tracking-wider flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-[#00FF9D] animate-pulse"></span>
                                LIVE STANDINGS
                            </h2>
                            {address && !isUnsynced && (
                                <button
                                    onClick={handleManualSync}
                                    disabled={isSyncing}
                                    className="ml-2 px-3 py-1 bg-[#D900FF]/20 hover:bg-[#D900FF]/40 border border-[#D900FF]/50 rounded text-[9px] text-[#D900FF] font-bold tracking-widest uppercase transition-all flex items-center gap-1 active:scale-95"
                                >
                                    {isSyncing ? "..." : "⚡ FORCE SYNC"}
                                </button>
                            )}
                            <button
                                onClick={() => setRefreshTrigger(p => p + 1)}
                                disabled={isRefreshing}
                                className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
                            >
                                <svg className={`w-3 h-3 text-zinc-400 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            </button>

                            {/* STATUS INDICATOR (Highly Visible) */}
                            <div className={`px-2 py-0.5 rounded flex items-center gap-1.5 ${serverStatus === 'ONLINE' ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${serverStatus === 'ONLINE' ? 'bg-green-500 shadow-[0_0_5px_lime]' : 'bg-red-500 animate-pulse shadow-[0_0_5px_red]'}`}></div>
                                <span className={`text-[9px] font-bold tracking-widest ${serverStatus === 'ONLINE' ? 'text-green-500' : 'text-red-500'}`}>
                                    {serverStatus === 'ONLINE' ? 'NET OK' : 'NET ERR'}
                                </span>
                            </div>
                        </div>
                        {/* SERVER STATUS FOOTER */}
                        <div className="mt-8 flex flex-col items-center justify-center gap-2 opacity-60">
                            <div className={`w-fit px-2 py-0.5 rounded flex items-center gap-1.5 ${serverStatus === 'ONLINE' ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${serverStatus === 'ONLINE' ? 'bg-green-500 shadow-[0_0_5px_lime]' : serverStatus === 'ERROR' ? 'bg-red-600 shadow-[0_0_5px_red]' : 'bg-yellow-500 animate-bounce'}`}></div>
                                <span className="text-[9px] font-mono text-zinc-500 tracking-widest uppercase">
                                    {serverStatus === 'ONLINE' ? 'NETWORK OPERATIONAL' : serverStatus === 'ERROR' ? 'DATA FEED DISCONNECTED' : 'ESTABLISHING UPLINK...'}
                                </span>
                            </div>

                            {/* DIAGNOSTIC OUTPUT */}
                            {serverStatus === 'ERROR' && debugInfo && (
                                <div className="text-[9px] text-red-400 font-mono text-center max-w-[250px] leading-tight">
                                    ERROR: {debugInfo}
                                </div>
                            )}
                        </div>
                        <span className="text-[10px] text-zinc-500 font-mono">{displayLeaderboard.length} PLAYERS</span>
                    </div>

                    <div className="space-y-2.5">
                        {displayLeaderboard.length === 0 ? (
                            <div className="text-center py-12 border border-dashed border-zinc-800 rounded-xl bg-black/20 flex flex-col items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center text-xl grayscale opacity-50">🏆</div>
                                <div>
                                    <p className="text-zinc-500 text-xs font-mono uppercase tracking-widest mb-1">No Records Yet</p>
                                    <p className="text-zinc-700 text-[10px]">Be the first to claim the throne.</p>
                                </div>
                            </div>
                        ) : (
                            displayLeaderboard.map((entry) => (
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
                                        <div className="flex flex-col justify-center">
                                            <Identity
                                                address={entry.address as `0x${string}`}
                                                className="flex items-center gap-2"
                                            >
                                                <Avatar
                                                    className="h-5 w-5 rounded-full ring-1 ring-white/10 shadow-sm"
                                                />
                                                <Name
                                                    className="text-xs font-mono text-zinc-200 tracking-wide hover:text-[#D900FF] transition-colors"
                                                />
                                            </Identity>
                                            {entry.rank <= 3 && <span className="text-[9px] text-[#D900FF] font-black tracking-widest pl-7 leading-none mt-0.5">LEADER</span>}
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        {entry.isPending ? (
                                            <span className="text-[10px] text-zinc-600 font-mono tracking-wider animate-pulse">REGISTERED</span>
                                        ) : (
                                            <span className="font-black text-xl text-white tabular-nums tracking-tight">{entry.score}</span>
                                        )}
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
