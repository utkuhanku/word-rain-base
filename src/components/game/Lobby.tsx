'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount } from 'wagmi';
import { useProfile } from '@farcaster/auth-kit';
import { getName } from '@coinbase/onchainkit/identity';
import { base } from 'viem/chains';
import sdk from "@farcaster/frame-sdk";
import GameWallet from '../ui/GameWallet';

interface LobbyProps {
    onStart: () => void;
}

export default function Lobby({ onStart }: LobbyProps) {
    const { address, isConnected } = useAccount();
    const { isAuthenticated, profile } = useProfile();

    // Identity State
    const [displayName, setDisplayName] = useState<string>('');
    const [isChecking, setIsChecking] = useState(true);
    const [isReady, setIsReady] = useState(false);

    // Fetch Identity Logic (Consolidated from IdentityReveal)
    useEffect(() => {
        const resolveIdentity = async () => {
            setIsChecking(true);

            // 1. Frame Context
            try {
                const context = await sdk.context;
                if (context?.user?.username) {
                    setDisplayName(context.user.username.toUpperCase());
                    setIsChecking(false);
                    return;
                }
            } catch (e) {
                // Ignore frame error
            }

            // 2. Farcaster Auth
            if (isAuthenticated && profile?.username) {
                setDisplayName(profile.username.toUpperCase());
                setIsChecking(false);
                return;
            }

            // 3. Wallet
            if (address) {
                try {
                    const name = await getName({ address, chain: base });
                    setDisplayName((name ?? "PLAYER ONE").toUpperCase());
                } catch {
                    setDisplayName("PLAYER ONE");
                }
            } else {
                setDisplayName(""); // Anonymous
            }
            setIsChecking(false);
        };

        resolveIdentity();
    }, [address, isAuthenticated, profile]);

    // Ready State Animation
    useEffect(() => {
        if (!isChecking) {
            const timer = setTimeout(() => setIsReady(true), 500);
            return () => clearTimeout(timer);
        }
    }, [isChecking]);

    return (
        <div className="flex flex-col items-center justify-center w-full h-full relative z-20">
            {/* Background Ambience */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] bg-[#0052FF]/5 blur-[120px] rounded-full animate-pulse" />
            </div>

            <AnimatePresence mode="wait">
                {isReady ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
                        transition={{ duration: 0.8, ease: "circOut" }}
                        className="flex flex-col items-center gap-12"
                    >
                        {/* Title Block */}
                        <div className="text-center space-y-4">
                            <motion.h1
                                className="text-6xl md:text-8xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-zinc-600 font-mono"
                                initial={{ y: 20 }}
                                animate={{ y: 0 }}
                                transition={{ duration: 0.8, delay: 0.2 }}
                            >
                                NEO RAIN
                            </motion.h1>
                            <motion.div
                                className="flex items-center justify-center gap-2 text-[#0052FF] text-xs font-mono tracking-[0.5em] uppercase"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.6 }}
                            >
                                <span className="w-2 h-2 bg-[#0052FF] rounded-full animate-ping" />
                                System Online
                            </motion.div>
                        </div>

                        {/* Identity Badge */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 1.0 }}
                            className="bg-white/5 border border-white/10 px-6 py-3 rounded-full backdrop-blur-md"
                        >
                            {displayName ? (
                                <span className="text-white font-mono text-sm tracking-widest">
                                    IDENTITY: <span className="text-[#0052FF] font-bold">{displayName}</span>
                                </span>
                            ) : (
                                <GameWallet />
                            )}
                        </motion.div>

                        {/* Start Button */}
                        <motion.button
                            onClick={onStart}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="group relative px-12 py-6 bg-white text-black font-black font-mono text-xl tracking-widest uppercase overflow-hidden"
                        >
                            <span className="relative z-10 group-hover:tracking-[0.2em] transition-all duration-300">
                                Initialize
                            </span>
                            <div className="absolute inset-0 bg-[#0052FF] transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left -z-0 opacity-20" />
                        </motion.button>

                    </motion.div>
                ) : (
                    // Loading State
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-white font-mono text-xs tracking-[0.5em] animate-pulse"
                    >
                        ESTABLISHING LINK...
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
