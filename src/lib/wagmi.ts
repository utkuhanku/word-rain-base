import { http, createConfig } from 'wagmi';
import { base } from 'wagmi/chains';
import { coinbaseWallet } from 'wagmi/connectors';

export const config = createConfig({
    chains: [base],
    multiInjectedProviderDiscovery: false,
    connectors: [
        coinbaseWallet({
            appName: 'Word Rain',
            preference: 'smartWalletOnly',
        }),
    ],
    transports: {
        [base.id]: http(),
    },
    ssr: true,
});
