'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function WalletButton() {
    return (
        <div className="fixed top-4 right-4 z-50">
            <ConnectButton accountStatus="avatar" chainStatus="none" showBalance={false} />
        </div>
    );
}
