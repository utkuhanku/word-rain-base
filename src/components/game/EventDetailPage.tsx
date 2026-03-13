'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, Name } from '@coinbase/onchainkit/identity';
import { base } from 'viem/chains';
import PlayerDetailModal from './PlayerDetailModal';

interface EventDetailPageProps {
    eventId: string;
    onBack: () => void;
}

export default function EventDetailPage({ eventId, onBack }: EventDetailPageProps) {
    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);

    useEffect(() => {
        const fetchEventData = async () => {
            setIsLoading(true);
            try {
                // Fetch top 50 participants for this specific event partition
                const res = await fetch(`/api/leaderboard/top?limit=50&partition=${eventId}`);
                if (res.ok) {
                    const data = await res.json();
                    setLeaderboard(Array.isArray(data.leaderboard) ? data.leaderboard : []);
                }
            } catch (error) {
                console.error("Failed to fetch event leaderboard:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchEventData();
    }, [eventId]);

    // Same verified logic from EventLobby
    const isVerified = (entry: any): boolean => {
        const u = (entry.username || '').trim().toLowerCase();
        if (!u || u.startsWith('0x')) return false;
        return true;
    };

    const verifiedPilots = leaderboard.filter(isVerified);
    const anonymousPilots = leaderboard.filter((entry: any) => !isVerified(entry));

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-0 z-50 flex flex-col w-full h-[100dvh] max-w-md mx-auto bg-black font-mono overflow-hidden"
        >
            {/* Header */}
            <div className="flex items-center gap-4 p-6 border-b border-white/10 bg-[#050505] shrink-0">
                <button
                    onClick={onBack}
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-colors text-white"
                >
                    <span className="text-xl">←</span>
                </button>
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500/80" />
                        <span className="text-[9px] font-black text-red-500/80 tracking-widest uppercase">CONCLUDED</span>
                    </div>
                    <h1 className="text-xl font-black text-white italic tracking-tighter uppercase leading-tight">
                        {eventId === 'ethdenver' ? (
                            <>ETH<span className="text-zinc-500">DENVER</span> 2026</>
                        ) : (
                            eventId.toUpperCase()
                        )}
                    </h1>
                </div>
            </div>

            {/* Stats Bar */}
            <div className="flex justify-between items-center px-6 py-3 bg-[#0a0a0a] border-b border-white/5 shrink-0">
                <span className="text-[9px] text-zinc-500 tracking-widest uppercase font-bold">17 PILOTS</span>
                <span className="text-[9px] text-[#0052FF] tracking-widest uppercase font-bold">$500 DISTRIBUTED</span>
                <span className="text-[9px] text-zinc-500 tracking-widest uppercase font-bold">FEB 2026</span>
            </div>

            {/* Leaderboard Content */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-40 gap-4">
                        <div className="w-6 h-6 border-2 border-[#0052FF] border-t-transparent rounded-full animate-spin" />
                        <span className="text-[10px] text-zinc-500 tracking-widest uppercase animate-pulse">Accessing Archives...</span>
                    </div>
                ) : (
                    <div className="flex flex-col gap-6 pb-20">
                        {/* VERIFIED PILOTS */}
                        <div className="flex flex-col w-full rounded-2xl bg-[#030303] border border-white/5 overflow-hidden shadow-xl">
                            {verifiedPilots.map((entry: any, i: number) => {
                                const rank = i + 1;
                                const rankStyle = (() => {
                                    if (rank === 1) return {
                                        row: 'bg-gradient-to-r from-amber-500/[0.07] to-transparent border-b border-amber-500/10',
                                        rankNum: 'text-amber-500 font-black drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]',
                                        name: 'text-amber-100 font-bold',
                                        score: 'text-amber-500 font-black',
                                        bgTop: 'bg-gradient-to-br from-amber-900 to-black border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                                    };
                                    if (rank === 2) return {
                                        row: 'bg-gradient-to-r from-zinc-300/[0.05] to-transparent border-b border-white/5',
                                        rankNum: 'text-zinc-300 font-bold',
                                        name: 'text-zinc-100 font-semibold',
                                        score: 'text-zinc-300 font-bold',
                                        bgTop: 'bg-gradient-to-br from-zinc-700 to-black border-zinc-400/30'
                                    };
                                    if (rank === 3) return {
                                        row: 'bg-gradient-to-r from-orange-700/[0.05] to-transparent border-b border-white/5',
                                        rankNum: 'text-orange-600 font-bold',
                                        name: 'text-orange-100/90 font-semibold',
                                        score: 'text-orange-600 font-bold',
                                        bgTop: 'bg-gradient-to-br from-orange-950 to-black border-orange-700/30'
                                    };
                                    return {
                                        row: 'bg-transparent border-b border-white/5',
                                        rankNum: 'text-zinc-600',
                                        name: 'text-zinc-400',
                                        score: 'text-zinc-500 font-bold',
                                        bgTop: 'bg-[#050505] border-white/10'
                                    };
                                })();

                                return (
                                    <div
                                        key={entry.member || entry.address}
                                        onClick={() => setSelectedPlayer(entry)}
                                        className={`flex items-center justify-between p-4 cursor-pointer transition-all hover:bg-white/5 ${rankStyle.row}`}
                                    >
                                        <div className="flex items-center gap-4 relative z-10 w-full px-2">
                                            <div className={`font-mono text-xs w-6 text-center shrink-0 ${rankStyle.rankNum}`}>
                                                {rank}
                                            </div>

                                            <div className="relative shrink-0">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center overflow-hidden border ${rankStyle.bgTop}`}>
                                                    <div className={`absolute inset-0 flex items-center justify-center rounded-full`}>
                                                        <svg className={`w-1/2 h-1/2 ${rank <= 3 ? 'text-white' : 'text-zinc-600'} opacity-80`} viewBox="0 0 24 24" fill="currentColor">
                                                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                                                        </svg>
                                                    </div>
                                                    {entry.identifier && entry.identifier.startsWith('0x') ? (
                                                        <div className="absolute inset-0 w-full h-full z-20 rounded-full overflow-hidden flex items-center justify-center">
                                                            <Avatar address={entry.identifier as `0x${string}`} chain={base} className="w-full h-full object-cover" />
                                                        </div>
                                                    ) : entry.pfp_url && (
                                                        <img
                                                            src={entry.pfp_url}
                                                            alt="Profile"
                                                            className="absolute inset-0 w-full h-full object-cover rounded-full z-20"
                                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                        />
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex flex-col justify-center flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-sm truncate ${rankStyle.name}`}>
                                                        {(() => {
                                                            const displayName = entry.display_name || entry.username || entry.displayName || `Pilot ${entry.identifier?.slice(0, 4)}`;
                                                            return displayName.startsWith('@') ? displayName.slice(1) : displayName;
                                                        })()}
                                                    </span>
                                                    {entry.power_badge && <span className="text-[10px] shrink-0">⚡</span>}
                                                </div>
                                            </div>

                                            <div className="text-right shrink-0">
                                                <span className={`font-space text-lg tracking-tight ${rankStyle.score}`}>
                                                    {entry.score}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* ANONYMOUS PILOTS */}
                        {anonymousPilots.length > 0 && (
                            <div className="pt-2">
                                <div className="flex items-center gap-2 mb-4 px-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-600"></span>
                                    <h3 className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase">Anonymous Pilots</h3>
                                </div>
                                <div className="flex flex-col gap-2">
                                    {anonymousPilots.map((entry: any, i: number) => {
                                        const rank = leaderboard.findIndex((e: any) => e.member === entry.member) + 1;
                                        let anonAddress = entry.identifier || entry.address;
                                        if (anonAddress && anonAddress.length > 15) {
                                            anonAddress = `${anonAddress.slice(0, 6)}...${anonAddress.slice(-4)}`;
                                        }

                                        return (
                                            <div
                                                key={entry.member || entry.address}
                                                onClick={() => setSelectedPlayer(entry)}
                                                className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 cursor-pointer hover:bg-white/5 transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="font-mono text-xs w-6 text-center shrink-0 text-zinc-600">
                                                        {rank}
                                                    </div>
                                                    <span className="font-mono text-sm text-zinc-400 truncate">
                                                        {anonAddress}
                                                    </span>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <span className="font-space font-bold text-sm text-zinc-500">
                                                        {entry.score}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        
                        {/* Disqualified Callout */}
                        <div className="mt-4 p-4 border border-zinc-900 rounded-xl bg-[#020202] flex items-center justify-center opacity-50 grayscale transition-all hover:grayscale-0 hover:opacity-100">
                            <span className="text-[9px] text-zinc-600 uppercase tracking-widest font-bold">4 pilots disqualified for systemic exploitation.</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="w-full bg-[#050505] border-t border-white/10 p-4 shrink-0 flex items-center justify-center z-20 relative">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.2em] text-center">
                    Season concluded · Prizes distributed to top 3 wallets
                </span>
            </div>

            {/* Profile Modal */}
            <AnimatePresence>
                {selectedPlayer && (
                    <PlayerDetailModal
                        isOpen={true}
                        player={{
                            identifier: selectedPlayer.identifier || selectedPlayer.address || selectedPlayer.member,
                            score: selectedPlayer.score,
                            username: selectedPlayer.username,
                            pfp_url: selectedPlayer.pfp_url,
                            display_name: selectedPlayer.display_name || selectedPlayer.displayName,
                            power_badge: selectedPlayer.power_badge || false
                        }}
                        onClose={() => setSelectedPlayer(null)}
                    />
                )}
            </AnimatePresence>
        </motion.div>
    );
}
