import { useState, useCallback, useEffect } from 'react';
import { usePublicClient, useWalletClient, useAccount } from 'wagmi';
import { getContract } from 'viem';
import { PvPRegistryABI } from '@/lib/abi/PvPRegistryABI';

// TODO: Set this env var after deployment
const PVP_ADDRESS = process.env.NEXT_PUBLIC_PVP_REGISTRY_ADDRESS as `0x${string}` || "0xf18E9b71678306f9Bf22e32bcf9a0683091ef370";
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // Base USDC

// ERC20 Minimal ABI for Approval
const ERC20_ABI = [
    {
        name: 'approve',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
        outputs: [{ name: '', type: 'bool' }]
    },
    {
        name: 'allowance',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }]
    }
] as const;

export interface GameData {
    id: string;
    creator: string;
    stake: string;
    status: 'OPEN' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED';
    createdAt: number;
}

export function usePvP() {
    const { address } = useAccount();
    const publicClient = usePublicClient();
    const { data: walletClient } = useWalletClient();

    const [games, setGames] = useState<GameData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    // Fetch Open Games
    const fetchGames = useCallback(async () => {
        if (!publicClient || !PVP_ADDRESS || PVP_ADDRESS === "0x0000000000000000000000000000000000000000") return;

        setIsLoading(true);
        try {
            const contract = getContract({
                address: PVP_ADDRESS,
                abi: PvPRegistryABI,
                client: publicClient
            });

            const counter = await contract.read.gameIdCounter();
            const total = Number(counter);

            if (total === 0) {
                setGames([]);
                setIsLoading(false);
                return;
            }

            // Scan last 30 games efficiently via Multicall
            const limit = 30;
            const start = Math.max(0, total - limit);

            // Create indices in descending order (newest first)
            const indices: bigint[] = [];
            for (let i = total - 1; i >= start; i--) {
                indices.push(BigInt(i));
            }

            // Execute Multicall - Single RPC request
            const results = await publicClient.multicall({
                contracts: indices.map(id => ({
                    address: PVP_ADDRESS,
                    abi: PvPRegistryABI,
                    functionName: 'games',
                    args: [id]
                }))
            });

            const fetchedGames: GameData[] = [];

            results.forEach((res, index) => {
                if (res.status === 'success' && res.result) {
                    const game = res.result as unknown as [string, string, string, number, bigint, bigint, bigint, bigint];
                    // Struct: [creator, opponent, winner, state, totalPool, betAmount, createdAt, startedAt]

                    const gameId = indices[index].toString();
                    const stateMap = ['OPEN', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'REFUNDED'];
                    const statusStr = stateMap[Number(game[3])] as GameData['status'];
                    const betAmountVal = Number(game[5]) / 1000000;
                    const createdAtVal = Number(game[6]);

                    // Show OPEN games to everyone
                    // Show ACTIVE/REFUNDED only if involved (User is Creator or Opponent)
                    // (Optional: Show Completed if involved using history view later)
                    if (statusStr === 'OPEN' || ((statusStr === 'ACTIVE' || statusStr === 'REFUNDED') && (game[0] === address || game[1] === address))) {
                        fetchedGames.push({
                            id: gameId,
                            creator: game[0],
                            stake: betAmountVal.toString(),
                            status: statusStr,
                            createdAt: createdAtVal
                        });
                    }
                }
            });

            setGames(fetchedGames);
        } catch (e) {
            console.error("Error fetching games:", e);
        } finally {
            setIsLoading(false);
        }
    }, [publicClient, address]);

    // Create Game
    const createGame = async (stakeAmount: string) => {
        if (!walletClient || !address) throw new Error("Wallet not connected");
        if (PVP_ADDRESS === "0x0000000000000000000000000000000000000000") throw new Error("Contract not deployed");

        setIsCreating(true);
        try {
            const amountBigInt = BigInt(Math.floor(Number(stakeAmount) * 1000000));

            // 1. Approve USDC
            const usdc = getContract({
                address: USDC_ADDRESS,
                abi: ERC20_ABI,
                client: walletClient
            });

            const allowance = await publicClient?.readContract({
                address: USDC_ADDRESS,
                abi: ERC20_ABI,
                functionName: 'allowance',
                args: [address, PVP_ADDRESS]
            });

            if ((allowance as bigint) < amountBigInt) {
                const hash = await usdc.write.approve([PVP_ADDRESS, amountBigInt]);
                await publicClient?.waitForTransactionReceipt({ hash });
            }

            const registry = getContract({
                address: PVP_ADDRESS,
                abi: PvPRegistryABI,
                client: walletClient
            });

            const hash = await registry.write.createGame([amountBigInt]);
            const receipt = await publicClient?.waitForTransactionReceipt({ hash });

            let newGameId = "";
            // Find GameCreated Event
            // Event Signature: GameCreated(uint256 indexed gameId, address indexed creator, uint256 amount)
            // Topic 0: 0x... (We can rely on parsing via viem or just finding the log)
            // Just strictly assuming the contract emitted it.
            if (receipt) {
                // Find log from this contract
                const log = receipt.logs.find(l => l.address.toLowerCase() === PVP_ADDRESS.toLowerCase());
                if (log) {
                    // topic[0] is signature
                    // topic[1] is indexed gameId (uint256)
                    const gameIdHex = log.topics[1];
                    if (gameIdHex) {
                        newGameId = BigInt(gameIdHex).toString();
                    }
                }
            }

            await fetchGames(); // Refresh
            return newGameId;

        } catch (e: any) {
            if (e.message && e.message.includes("User rejected")) {
                console.warn("Create Game Cancelled by User");
                return; // Clean exit
            }
            console.error("Create Game Error:", e);
            throw e;
        } finally {
            setIsCreating(false);
        }
    };

    // Join Game
    const joinGame = async (gameId: string, stakeAmount: string) => {
        if (!walletClient || !address) throw new Error("Wallet not connected");
        if (PVP_ADDRESS === "0x0000000000000000000000000000000000000000") throw new Error("Contract not deployed");

        try {
            const amountBigInt = BigInt(Math.floor(Number(stakeAmount) * 1000000));

            // 1. Approve USDC 
            const usdc = getContract({
                address: USDC_ADDRESS,
                abi: ERC20_ABI,
                client: walletClient
            });
            const allowance = await publicClient?.readContract({
                address: USDC_ADDRESS,
                abi: ERC20_ABI,
                functionName: 'allowance',
                args: [address, PVP_ADDRESS]
            });

            if ((allowance as bigint) < amountBigInt) {
                const hash = await usdc.write.approve([PVP_ADDRESS, amountBigInt]);
                await publicClient?.waitForTransactionReceipt({ hash });
            }

            // 2. Join
            const registry = getContract({
                address: PVP_ADDRESS,
                abi: PvPRegistryABI,
                client: walletClient
            });

            const hash = await registry.write.joinGame([BigInt(gameId)]);
            await publicClient?.waitForTransactionReceipt({ hash });

            await fetchGames();
            return true;

        } catch (e) {
            console.error("Join Error:", e);
            throw e;
        }
    };

    // Buy Revive
    const buyRevive = async (gameId: string) => {
        if (!walletClient) throw new Error("No wallet");
        // Revive is 1 USDC hardcoded
        const REVIVE_COST = BigInt(1000000);

        try {
            // Check Approval for 1 USDC
            const usdc = getContract({
                address: USDC_ADDRESS,
                abi: ERC20_ABI,
                client: walletClient
            });
            const allowance = await publicClient?.readContract({
                address: USDC_ADDRESS,
                abi: ERC20_ABI,
                functionName: 'allowance',
                args: [address!, PVP_ADDRESS]
            });

            if ((allowance as bigint) < REVIVE_COST) {
                const hash = await usdc.write.approve([PVP_ADDRESS, REVIVE_COST]);
                await publicClient?.waitForTransactionReceipt({ hash });
            }

            const registry = getContract({
                address: PVP_ADDRESS,
                abi: PvPRegistryABI,
                client: walletClient
            });
            const hash = await registry.write.buyRevive([BigInt(gameId)]);
            await publicClient?.waitForTransactionReceipt({ hash });
        } catch (e) {
            console.error("Buy Revive Error:", e);
            throw e;
        }
    };

    // Refund Stale Game
    const refundStaleGame = async (gameId: string) => {
        if (!walletClient) throw new Error("No wallet");
        try {
            const registry = getContract({
                address: PVP_ADDRESS,
                abi: PvPRegistryABI,
                client: walletClient
            });
            const hash = await registry.write.refundStaleGame([BigInt(gameId)]);
            await publicClient?.waitForTransactionReceipt({ hash });
            await fetchGames();
        } catch (e) {
            console.error("Refund Error:", e);
            throw e;
        }
    };

    // Cancel Game
    const cancelGame = async (gameId: string) => {
        if (!walletClient) throw new Error("No wallet");
        try {
            const registry = getContract({
                address: PVP_ADDRESS,
                abi: PvPRegistryABI,
                client: walletClient
            });
            const hash = await registry.write.cancelGame([BigInt(gameId)]);
            await publicClient?.waitForTransactionReceipt({ hash });
            await fetchGames();
        } catch (e) {
            console.error("Cancel Error:", e);
            throw e;
        }
    };

    return {
        games,
        fetchGames,
        createGame,
        joinGame,
        cancelGame,
        buyRevive,
        refundStaleGame,
        isLoading,
        isCreating
    };
}
