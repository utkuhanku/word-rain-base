import { http, createConfig } from 'wagmi';
import { base } from 'wagmi/chains';
import { coinbaseWallet, injected } from 'wagmi/connectors';
import { Attribution } from 'ox/erc8021';

// Base Builder Code Attribution
const BUILDER_ID = process.env.NEXT_PUBLIC_BASE_BUILDER_ID;
const dataSuffix = BUILDER_ID
    ? Attribution.toDataSuffix({ codes: [BUILDER_ID] })
    : undefined;



export const config = createConfig({
    chains: [base],
    multiInjectedProviderDiscovery: false,
    connectors: [
        coinbaseWallet({
            appName: 'Word Rain',
            preference: 'smartWalletOnly',
            version: '4',
        }),
        injected(),
    ],
    transports: {
        [base.id]: http(),
    },
    dataSuffix, // Inject Builder Code into all transactions
    ssr: true,
});
