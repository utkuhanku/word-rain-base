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
                <ConnectWallet className="bg-[#111] text-white border border-[#222] font-mono hover:bg-[#222] transition-colors px-4 py-2 rounded-lg">
                    <Avatar className="h-6 w-6 mr-2" />
                    <Name />
                </ConnectWallet>
                <WalletDropdown className="bg-[#111] border border-[#222]">
                    <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
                        <Avatar />
                        <Name className="text-white" />
                        <Address className="text-zinc-400" />
                        <EthBalance className="text-zinc-400" />
                    </Identity>
                    <WalletDropdownLink icon="wallet" href="https://keys.coinbase.com" className="hover:bg-[#222] text-white">
                        Wallet
                    </WalletDropdownLink>
                    <WalletDropdownDisconnect className="hover:bg-[#222] text-white" />
                </WalletDropdown>
            </Wallet>
        </div>
    );
}
