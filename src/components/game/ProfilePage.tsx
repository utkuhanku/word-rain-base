'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAccount } from 'wagmi';
import { ConnectWallet } from '@coinbase/onchainkit/wallet';

interface ProfilePageProps {
    onBack: () => void;
}

export default function ProfilePage({ onBack }: ProfilePageProps) {
    const { address, isConnected } = useAccount();
    const [profile, setProfile] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const fetchProfile = async () => {
            if (!address) return;
            setIsLoading(true);
            try {
                const res = await fetch(`/api/profile?address=${address}`);
                if (res.ok) {
                    const data = await res.json();
                    setProfile(data);
                }
            } catch (err) {
                console.error("Failed to fetch profile", err);
            } finally {
                setIsLoading(false);
            }
        };

        if (isConnected) {
            fetchProfile();
        }
    }, [address, isConnected]);

    const truncateAddress = (addr: string) => {
        if (!addr) return '';
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    const handleCopy = () => {
        if (address) {
            navigator.clipboard.writeText(address);
        }
    };

    if (!isConnected) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="flex flex-col items-center justify-center w-full h-[100dvh] max-w-md mx-auto bg-black font-mono p-6"
            >
                <div className="flex flex-col items-center justify-center gap-6 w-full max-w-xs text-center">
                    <div className="w-20 h-20 rounded-full border-2 border-white/10 bg-[#050505] flex items-center justify-center border-dashed">
                        <span className="text-3xl grayscale opacity-50">👤</span>
                    </div>
                    <div className="flex flex-col gap-2">
                        <h2 className="text-xl font-black text-white italic tracking-tighter uppercase">ACCESS DENIED</h2>
                        <p className="text-xs text-zinc-500 font-mono">Connect your wallet to view your pilot dossier and mission history.</p>
                    </div>
                    <div className="w-full relative z-50">
                        <ConnectWallet className="w-full !bg-white !text-black !rounded-xl !font-mono !text-xs !font-bold uppercase tracking-widest hover:!bg-zinc-200 transition-colors py-3 shadow-[0_0_20px_rgba(255,255,255,0.1)]" />
                    </div>
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="flex flex-col w-full h-[100dvh] max-w-md mx-auto bg-black font-mono overflow-y-auto pb-24 custom-scrollbar"
        >
            {/* Header Area */}
            <div className="flex flex-col p-6 pt-10 items-center justify-center relative shrink-0">
                {/* Background ambient glow based on score/streak if needed, default to blue */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-[#0052FF]/10 blur-[50px] rounded-full pointer-events-none" />
                
                <div className="relative">
                    <div className="w-24 h-24 rounded-full border-[3px] border-[#0052FF]/50 bg-[#050505] overflow-hidden flex items-center justify-center shadow-[0_0_30px_rgba(0,82,255,0.2)] mb-4">
                        {profile?.pfp_url ? (
                            <img src={profile.pfp_url} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <svg className="w-10 h-10 text-[#0052FF]/50" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                            </svg>
                        )}
                    </div>
                    {/* Optional Power Badge or Status Icon could go here */}
                </div>

                <div className="flex flex-col items-center gap-1 z-10 w-full text-center">
                    <h1 className="text-2xl font-black text-white tracking-tight truncate max-w-[280px]">
                        {profile?.display_name || profile?.username || truncateAddress(address as string)}
                    </h1>
                    
                    <button 
                        onClick={handleCopy}
                        className="flex items-center gap-2 text-xs text-zinc-500 font-mono hover:text-white transition-colors bg-white/5 px-3 py-1 rounded-full cursor-pointer active:scale-95"
                    >
                        {truncateAddress(address as string)}
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    </button>

                    {profile?.platform === 'base' && (
                        <div className="mt-3 flex items-center gap-1 bg-[#0052FF]/10 border border-[#0052FF]/30 px-3 py-1 rounded-full">
                            <div className="w-3 h-3 rounded-full bg-[#0052FF]" />
                            <span className="text-[10px] font-bold text-[#0052FF] tracking-widest uppercase">Base Pilot</span>
                        </div>
                    )}
                </div>
            </div>

            {isLoading ? (
                <div className="flex-1 flex justify-center items-center">
                    <span className="text-[10px] text-zinc-500 tracking-widest uppercase animate-pulse">Syncing Dossier...</span>
                </div>
            ) : profile ? (
                <div className="flex flex-col px-6 gap-6">
                    {/* STATS GRID */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-4 flex flex-col justify-between hover:bg-white/[0.02] transition-colors relative overflow-hidden group">
                            <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold mb-2 z-10">Best Score</span>
                            <span className="text-3xl font-black text-white font-space z-10">{profile.bestScore}</span>
                            <div className="absolute right-0 bottom-0 text-7xl opacity-[0.02] grayscale group-hover:opacity-5 transition-opacity pointer-events-none">⭐</div>
                        </div>

                        <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-4 flex flex-col justify-between hover:bg-white/[0.02] transition-colors relative overflow-hidden group">
                            <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold mb-2 z-10">Events Entered</span>
                            <span className="text-3xl font-black text-white font-space z-10">{profile.eventsEntered}</span>
                            <div className="absolute right-0 bottom-0 text-7xl opacity-[0.02] grayscale group-hover:opacity-5 transition-opacity pointer-events-none">🎯</div>
                        </div>

                        <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-4 flex flex-col justify-between hover:bg-white/[0.02] transition-colors relative overflow-hidden group">
                            <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold mb-2 z-10">GM Streak</span>
                            <div className="flex items-center gap-2 z-10">
                                <span className="text-2xl">🔥</span>
                                <span className="text-3xl font-black text-white font-space">{profile.streak}</span>
                            </div>
                            <div className="absolute right-0 bottom-0 text-7xl opacity-[0.02] grayscale group-hover:opacity-5 transition-opacity pointer-events-none">🔥</div>
                        </div>

                        <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-4 flex flex-col justify-between hover:bg-white/[0.02] transition-colors relative overflow-hidden group">
                            <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold mb-2 z-10">Lives Used</span>
                            <div className="flex items-center gap-2 z-10">
                                <span className="text-2xl">❤️</span>
                                <span className="text-3xl font-black text-white font-space">{profile.revivesUsed}</span>
                            </div>
                            <div className="absolute right-0 bottom-0 text-7xl opacity-[0.02] grayscale group-hover:opacity-5 transition-opacity pointer-events-none">❤️</div>
                        </div>
                    </div>

                    {/* EVENT HISTORY */}
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2 mb-4 px-2">
                            <div className="w-1.5 h-1.5 bg-zinc-600 rounded-full" />
                            <h3 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest font-mono">
                                Event History
                            </h3>
                        </div>

                        <div className="flex flex-col gap-2">
                            {profile.omegaScore !== null && (
                                <div className="bg-[#050505] border border-white/5 rounded-xl p-3 flex flex-col gap-2 shadow-inner">
                                    <div className="flex items-center justify-between w-full">
                                        <div className="flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                            <span className="text-[9px] font-black text-red-500 tracking-widest uppercase">LIVE</span>
                                        </div>
                                        <span className="text-[9px] text-[#0052FF] font-mono tracking-widest uppercase items-center flex gap-1 bg-white/5 px-2 py-0.5 rounded border border-white/5">
                                            $500 <span className="text-zinc-400">POOL</span>
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between mt-1">
                                        <h4 className="text-sm font-black text-white italic tracking-tighter">#OMEGA</h4>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-zinc-500 uppercase tracking-widest">Score:</span>
                                            <span className="text-base font-bold text-white font-space">{profile.omegaScore}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {profile.ethdenverScore !== null && (
                                <div className="bg-black border border-white/5 rounded-xl p-3 flex flex-col gap-2 opacity-80 hover:opacity-100 transition-opacity">
                                    <div className="flex items-center justify-between w-full">
                                        <div className="flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                                            <span className="text-[9px] font-black text-zinc-600 tracking-widest uppercase">CONCLUDED</span>
                                        </div>
                                        <span className="text-[9px] text-zinc-500 font-mono tracking-widest uppercase">
                                            $500 DISTRIBUTED
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between mt-1">
                                        <h4 className="text-sm font-black text-zinc-400 italic tracking-tighter">ETH<span className="text-zinc-600">DENVER</span> 2026</h4>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-zinc-600 uppercase tracking-widest">Score:</span>
                                            <span className="text-base font-bold text-zinc-400 font-space">{profile.ethdenverScore}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {profile.omegaScore === null && profile.ethdenverScore === null && (
                                <div className="py-8 text-center border border-white/5 border-dashed rounded-xl bg-white/[0.01]">
                                    <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">No event history found</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* LAST ACTIVE */}
                    {profile.lastActive && (
                        <div className="mt-2 flex justify-center w-full">
                            <span className="text-[9px] text-zinc-600 uppercase tracking-widest font-mono">
                                LAST ACTIVE: {new Date(profile.lastActive).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                            </span>
                        </div>
                    )}
                </div>
            ) : null}
        </motion.div>
    );
}
