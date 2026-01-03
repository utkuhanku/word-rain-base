'use client';

import { useEffect, useState } from 'react';
import { useAccount, useEnsName } from 'wagmi';
import { getName } from '@coinbase/onchainkit/identity';
import { base } from 'viem/chains';
import { useProfile } from '@farcaster/auth-kit';

interface IdentityRevealProps {
    onComplete: () => void;
}

export default function IdentityReveal({ onComplete }: IdentityRevealProps) {
    const { address, isConnected } = useAccount();
    const { isAuthenticated, profile } = useProfile(); // Farcaster Auth
    const [displayName, setDisplayName] = useState<string>('INITIATE');
    const [displayedText, setDisplayedText] = useState('');
    const [isRevealing, setIsRevealing] = useState(true);

    // Safety: Force complete after 6 seconds max to prevent blocking
    useEffect(() => {
        const safety = setTimeout(() => {
            if (isRevealing) {
                setIsRevealing(false);
                onComplete();
            }
        }, 6000);
        return () => clearTimeout(safety);
    }, [isRevealing, onComplete]);

    // Fetch Identity (Farcaster > Basename > Address)
    useEffect(() => {
        const fetchIdentity = async () => {
            if (isAuthenticated && profile?.username) {
                setDisplayName(profile.username.toUpperCase());
            } else if (address) {
                try {
                    const name = await getName({ address, chain: base });
                    setDisplayName((name ?? "PLAYER ONE").toUpperCase());
                } catch {
                    setDisplayName("PLAYER ONE");
                }
            } else {
                setDisplayName("PLAYER ONE");
            }
        };
        fetchIdentity();
    }, [address, isAuthenticated, profile]);

    // Decode Animation
    useEffect(() => {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";
        let iterations = 0;

        const interval = setInterval(() => {
            setDisplayedText(
                displayName
                    .split("")
                    .map((letter, index) => {
                        if (index < iterations) {
                            return displayName[index];
                        }
                        return chars[Math.floor(Math.random() * chars.length)];
                    })
                    .join("")
            );

            if (iterations >= displayName.length) {
                clearInterval(interval);
                setTimeout(() => {
                    setIsRevealing(false);
                    onComplete();
                }, 1000); // Hold for 1s
            }

            iterations += 1 / 3; // Speed of decode
        }, 30);

        return () => clearInterval(interval);
    }, [displayName, onComplete]);

    if (!isRevealing) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-[#050505] flex flex-col items-center justify-center pointer-events-none">
            <div className="text-4xl md:text-6xl font-black font-mono tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600 animate-pulse">
                {displayedText}
            </div>
            <div className="mt-4 text-xs font-mono text-zinc-500 tracking-[0.5em] uppercase">
                Identification Verified
            </div>
        </div>
    );
}
