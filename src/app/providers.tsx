'use client';

import { OnchainKitProvider } from '@coinbase/onchainkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { base } from 'wagmi/chains';
import { type ReactNode, useState } from 'react';
import { WagmiProvider } from 'wagmi';
import { AuthKitProvider } from '@farcaster/auth-kit';
import '@farcaster/auth-kit/styles.css';

import { config } from '@/lib/wagmi';

const farcasterConfig = {
    rpcUrl: 'https://mainnet.optimism.io', // Mainnet Optimism RPC for Farcaster
    domain: 'word-rain-base.vercel.app',
    siweUri: 'https://word-rain-base.vercel.app/api/auth/siwe',
};

export function Providers(props: { children: ReactNode }) {
    const [queryClient] = useState(() => new QueryClient());

    return (
        <AuthKitProvider config={farcasterConfig}>
            <WagmiProvider config={config}>
                <QueryClientProvider client={queryClient}>
                    <OnchainKitProvider
                        apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
                        chain={base}
                    >
                        {props.children}
                    </OnchainKitProvider>
                </QueryClientProvider>
            </WagmiProvider>
        </AuthKitProvider>
    );
}
