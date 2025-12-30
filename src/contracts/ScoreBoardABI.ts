export const ScoreBoardABI = [
    {
        "type": "function",
        "name": "submitScore",
        "inputs": [{ "name": "score", "type": "uint256" }],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "getBestScore",
        "inputs": [{ "name": "player", "type": "address" }],
        "outputs": [{ "name": "", "type": "uint256" }],
        "stateMutability": "view"
    }
] as const;

// Placeholder address for Base Sepolia or Base Mainnet
export const SCOREBOARD_ADDRESS = "0x0000000000000000000000000000000000000000"; 
