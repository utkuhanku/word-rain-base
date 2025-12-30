import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base } from 'wagmi/chains';

export const config = getDefaultConfig({
    appName: 'Word Rain',
    projectId: 'd578673a0058e104526df613dcf58849', // Public testing ID, users should replace for mainnet
    chains: [base],
    ssr: true,
});
