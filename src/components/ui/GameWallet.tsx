'use client';

import {
    ConnectWallet,
    Wallet,
    WalletDropdown,
    WalletDropdownDisconnect,
    WalletDropdownLink
} from '@coinbase/onchainkit/wallet';
import {
    Address,
    Avatar,
    Name,
    Identity,
    EthBalance
} from '@coinbase/onchainkit/identity';

export default function GameWallet() {
    return (
        <div className="flex justify-end">
            <Wallet>
                <ConnectWallet className="bg-white text-black font-mono font-bold hover:bg-zinc-200 transition-colors px-4 py-2 rounded-none">
                    <Avatar className="h-6 w-6 mr-2" />
                    <Name />
                </ConnectWallet>
                <WalletDropdown>
                    <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
                        <Avatar />
                        <Name />
                        <Address />
                        <EthBalance />
                    </Identity>
                    <WalletDropdownLink icon="wallet" href="https://keys.coinbase.com">
                        Wallet
                    </WalletDropdownLink>
                    <WalletDropdownDisconnect />
                </WalletDropdown>
            </Wallet>
        </div>
    );
}
