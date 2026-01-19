'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePvP, GameData } from '@/lib/hooks/usePvP';
import { useAccount } from 'wagmi';

interface CompetitionLobbyProps {
    onClose: () => void;
    onStartGame: (gameId: string) => void;
}

export default function CompetitionLobby({ onClose, onStartGame }: CompetitionLobbyProps) {
    const { address } = useAccount();
    const { games, fetchGames, createGame, cancelGame, isLoading, isCreating: isTxPending, joinGame } = usePvP();

    const [activeTab, setActiveTab] = useState<'browse' | 'my-tables'>('browse');
    const [isProcessing, setIsProcessing] = useState(false);
    const [tooltipGameId, setTooltipGameId] = useState<string | null>(null);

    // Creation Wizard State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createStep, setCreateStep] = useState<1 | 2>(1);
    const [wagerAmount, setWagerAmount] = useState<string>("1");

    useEffect(() => {
        fetchGames();
        const interval = setInterval(fetchGames, 10000);
        return () => clearInterval(interval);
    }, [fetchGames]);

    const handleConfirmCreate = async () => {
        if (isProcessing || isTxPending) return;
        const amount = Number(wagerAmount);
        if (isNaN(amount) || amount < 1) return;

        setIsProcessing(true);
        try {
            const gameId = await createGame(wagerAmount);
            setShowCreateModal(false);
            setCreateStep(1);
            if (gameId) {
                onStartGame(gameId);
            }
        } catch (e) {
            console.error(e);
            alert("Transaction Failed. Check console.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleJoin = async (gameId: string, stake: string) => {
        if (isProcessing || isTxPending) return;
        setIsProcessing(true);
        try {
            await joinGame(gameId, stake);
            onStartGame(gameId);
        } catch (e) {
            console.error(e);
            alert("Join Failed. Check console.");
        } finally {
            setIsProcessing(false);
        }
    }

    const handleCancel = async (gameId: string) => {
        if (isProcessing) return;
        setIsProcessing(true);
        try {
            await cancelGame(gameId);
        } catch (e) {
            console.error(e);
        } finally {
            setIsProcessing(false);
        }
    };

    const myGames = games.filter(g => g.creator.toLowerCase() === address?.toLowerCase());
    const openGames = games.filter(g => g.status === 'OPEN'); // Removed exclusion of self

    const isLocked = (game: GameData) => {
        const now = Math.floor(Date.now() / 1000);
        return now < game.createdAt + 3600; // 1 hour
    };

    // Wizard Calculations
    const potentialWin = Number(wagerAmount) * 2 * 0.8;
    const protocolFee = Number(wagerAmount) * 2 * 0.2;

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
            {/* Main Backdrop */}
            <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={onClose} />

            {/* Creation Wizard Modal */}
            <AnimatePresence>
                {showCreateModal && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none"
                    >
                        <div className="w-full max-w-md bg-[#080808] border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.9)] rounded-2xl overflow-hidden pointer-events-auto flex flex-col relative">
                            {/* Wizard Header */}
                            <div className="p-6 border-b border-white/5 bg-zinc-900/40 flex justify-between items-center">
                                <h3 className="text-lg font-bold font-mono text-white tracking-widest uppercase">
                                    {createStep === 1 ? "Protocol Rules" : "Setup Wager"}
                                </h3>
                                <button
                                    onClick={() => { setShowCreateModal(false); setCreateStep(1); }}
                                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-zinc-500 hover:text-white transition-all"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="p-8 flex-1">
                                {createStep === 1 ? (
                                    <div className="space-y-6">
                                        <div className="space-y-4">
                                            <div className="bg-white/5 p-4 rounded-lg border border-white/5">
                                                <h4 className="text-[#0052FF] font-mono font-bold text-xs uppercase tracking-widest mb-2">The Stakes</h4>
                                                <p className="text-zinc-400 text-sm leading-relaxed">
                                                    Winner takes <span className="text-white font-bold">80%</span> of the total pool.
                                                    The protocol retains <span className="text-white font-bold">20%</span> as a platform fee.
                                                </p>
                                            </div>
                                            <div className="bg-white/5 p-4 rounded-lg border border-white/5">
                                                <h4 className="text-amber-500 font-mono font-bold text-xs uppercase tracking-widest mb-2">Anti-Cheat Lock</h4>
                                                <p className="text-zinc-400 text-sm leading-relaxed">
                                                    Once created, the table is locked for <span className="text-white font-bold">1 Hour</span>.
                                                    You can only cancel and refund if no opponent joins after this period.
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setCreateStep(2)}
                                            className="w-full h-12 bg-white text-black font-mono font-bold uppercase tracking-widest hover:bg-zinc-200 transition-colors rounded-sm"
                                        >
                                            Continue
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <label className="text-xs font-mono text-zinc-500 uppercase tracking-widest">
                                                Wager Amount (USDC)
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={wagerAmount}
                                                    onChange={(e) => setWagerAmount(e.target.value)}
                                                    className="w-full h-16 bg-black border border-white/20 text-white font-mono text-2xl px-4 focus:border-[#0052FF] focus:outline-none transition-colors rounded-sm text-center"
                                                    placeholder="1"
                                                />
                                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 font-mono text-xs">USDC</span>
                                            </div>
                                            <p className="text-[10px] text-zinc-500 text-center font-mono">Minimum 1 USDC</p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 py-4 border-t border-b border-white/5">
                                            <div className="text-center">
                                                <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Total Pool</div>
                                                <div className="text-white font-mono text-lg">{(Number(wagerAmount) * 2).toFixed(2)}</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-[10px] font-mono text-emerald-500 uppercase tracking-widest mb-1">You Win</div>
                                                <div className="text-emerald-500 font-mono text-lg">{potentialWin.toFixed(2)} USDC</div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={handleConfirmCreate}
                                            disabled={isProcessing || isTxPending || Number(wagerAmount) < 1}
                                            className="w-full h-14 bg-[#0052FF] hover:bg-[#0040DD] disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-space font-bold text-sm tracking-widest uppercase shadow-[0_0_20px_rgba(0,82,255,0.3)] transition-all rounded-sm flex flex-col items-center justify-center gap-0.5"
                                        >
                                            {isProcessing ? "PROCESSING..." : (
                                                <>
                                                    <span>CONFIRM & DEPOSIT</span>
                                                    <span className="text-[9px] font-mono opacity-60 font-medium normal-case">Approve {wagerAmount} USDC</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Browsing Card */}
            <div className={`w-full max-w-md h-[85vh] flex flex-col bg-[#050505] border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] relative z-10 rounded-xl overflow-hidden transition-all duration-300 ${showCreateModal ? 'blur-sm scale-95 opacity-50' : 'scale-100 opacity-100'}`}>

                {/* Header */}
                <div className="p-6 border-b border-white/5 bg-zinc-900/20 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold tracking-tight text-white uppercase font-mono flex items-center gap-2">
                            <span className="text-[#0052FF]">PvP</span> ARENA
                        </h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className={`w-1.5 h-1.5 rounded-full ${isLoading ? "bg-amber-500" : "bg-[#0052FF]"} animate-pulse shadow-[0_0_10px_#0052FF]`} />
                            <p className="text-zinc-500 text-[10px] font-mono tracking-widest uppercase">
                                {isLoading ? "Syncing..." : "Live Competitions"}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-zinc-500 hover:text-white transition-all"
                    >
                        ✕
                    </button>
                </div>

                {/* Controls */}
                <div className="p-4 flex gap-2">
                    <button
                        onClick={() => setActiveTab('browse')}
                        className={`flex-1 h-10 text-[10px] font-bold font-mono uppercase tracking-widest transition-all rounded-sm border ${activeTab === 'browse' ? "bg-white text-black border-white" : "bg-transparent text-zinc-500 border-white/10 hover:border-white/30"}`}
                    >
                        Available ({openGames.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('my-tables')}
                        className={`flex-1 h-10 text-[10px] font-bold font-mono uppercase tracking-widest transition-all rounded-sm border ${activeTab === 'my-tables' ? "bg-white text-black border-white" : "bg-transparent text-zinc-500 border-white/10 hover:border-white/30"}`}
                    >
                        My Tables ({myGames.length})
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {activeTab === 'browse' && (
                        <>
                            {/* Create Button */}
                            <button
                                onClick={() => setShowCreateModal(true)}
                                disabled={isProcessing || isTxPending}
                                className="w-full h-14 bg-[#0052FF] hover:bg-[#0040DD] disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-space font-bold text-sm tracking-widest uppercase flex items-center justify-between px-6 mb-6 shadow-[0_0_20px_rgba(0,82,255,0.3)] transition-all group rounded-sm"
                            >
                                <span className="flex items-center gap-2">
                                    {isProcessing ? "PROCESSING..." : "CREATE NEW TABLE"}
                                </span>
                                <span className="text-xs opacity-70 group-hover:translate-x-1 transition-transform">
                                    +
                                </span>
                            </button>

                            {/* List */}
                            {openGames.length === 0 ? (
                                <div className="text-center py-10 opacity-30 font-mono text-xs uppercase tracking-widest">
                                    No Active Tables
                                </div>
                            ) : (
                                openGames.map((table, i) => (
                                    <div key={i} className="group w-full p-4 border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-all rounded-lg flex justify-between items-center">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-white font-mono font-bold text-sm">TABLE #{table.id}</span>
                                                <span className="text-[9px] px-1.5 py-0.5 border border-emerald-500/30 text-emerald-500 bg-emerald-500/10 rounded uppercase tracking-wider">
                                                    OPEN
                                                </span>
                                            </div>
                                            <span className="text-[10px] font-mono text-zinc-500 tracking-wider">
                                                BY: {table.creator.slice(0, 6)}...{table.creator.slice(-4)}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex flex-col items-end">
                                                <span className="text-[#0052FF] font-bold font-mono text-sm">{table.stake} USDC</span>
                                                <span className="text-[9px] text-zinc-600 font-mono tracking-wider">DEPOSIT</span>
                                            </div>
                                            {table.creator.toLowerCase() === address?.toLowerCase() ? (
                                                <span className="h-8 px-4 flex items-center justify-center border border-zinc-800 text-zinc-500 text-[10px] font-bold font-mono uppercase tracking-wider">
                                                    YOU
                                                </span>
                                            ) : (
                                                <button
                                                    onClick={() => handleJoin(table.id, table.stake)}
                                                    className="h-8 px-4 bg-white text-black text-[10px] font-bold font-mono uppercase tracking-wider hover:bg-zinc-200 transition-colors"
                                                >
                                                    VS
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </>
                    )}

                    {activeTab === 'my-tables' && (
                        <>
                            {myGames.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center opacity-30">
                                    <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest text-center leading-relaxed">
                                        NO ACTIVE TABLES
                                    </p>
                                </div>
                            ) : (
                                myGames.map((table, i) => (
                                    <div key={i} className="group w-full p-4 border border-white/5 bg-white/[0.02] transition-all rounded-lg flex justify-between items-center relative">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-white font-mono font-bold text-sm">TABLE #{table.id} {table.stake !== "5" && `(${table.stake} USDC)`}</span>
                                            <span className="text-[10px] font-mono text-zinc-500 tracking-wider">
                                                STATUS: {table.status}
                                            </span>
                                        </div>
                                        {table.status === 'OPEN' && (
                                            <div className="flex items-center gap-2">
                                                {typeof window !== 'undefined' && localStorage.getItem(`pvp_submitted_${table.id}`) ? (
                                                    <span className="text-[10px] font-mono text-emerald-500/70 tracking-wider mr-2 animate-pulse">
                                                        WAITING FOR OPPONENT...
                                                    </span>
                                                ) : (
                                                    <button
                                                        onClick={() => onStartGame(table.id)}
                                                        className="h-8 px-4 bg-emerald-500 text-black hover:bg-emerald-400 text-[10px] font-bold font-mono uppercase tracking-wider transition-colors mr-2"
                                                    >
                                                        PLAY / SET SCORE
                                                    </button>
                                                )}
                                                {isLocked(table) && (
                                                    <div
                                                        className="relative"
                                                        onMouseEnter={() => setTooltipGameId(table.id)}
                                                        onMouseLeave={() => setTooltipGameId(null)}
                                                    >
                                                        <span className="text-zinc-500 cursor-help text-xs">🔒 1h Lock</span>
                                                        {tooltipGameId === table.id && (
                                                            <div className="absolute bottom-full right-0 mb-2 w-48 bg-black border border-white/20 p-2 text-[9px] text-zinc-300 rounded shadow-xl z-50">
                                                                Protected against score-scumming. You can cancel and get full refund after 1 hour if no opponent joins.
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                <button
                                                    onClick={() => handleCancel(table.id)}
                                                    disabled={isProcessing || isLocked(table)}
                                                    className={`h-8 px-4 border text-[10px] font-bold font-mono uppercase tracking-wider transition-colors ${isLocked(table) ? "border-zinc-700 text-zinc-700 cursor-not-allowed" : "border-red-500/30 text-red-500 hover:bg-red-500/10"}`}
                                                >
                                                    CANCEL
                                                </button>
                                            </div>
                                        )}
                                        {table.status === 'ACTIVE' && (
                                            <button
                                                onClick={() => onStartGame(table.id)}
                                                className="h-8 px-4 bg-emerald-500 text-black hover:bg-emerald-400 text-[10px] font-bold font-mono uppercase tracking-wider transition-colors"
                                            >
                                                PLAY
                                            </button>
                                        )}
                                    </div>
                                ))
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
