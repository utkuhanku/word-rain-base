export const ScoreRegistryABI = [
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "internalType": "address", "name": "player", "type": "address" },
            { "indexed": false, "internalType": "uint256", "name": "score", "type": "uint256" },
            { "indexed": false, "internalType": "bytes32", "name": "gameId", "type": "bytes32" },
            { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" },
            { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" }
        ],
        "name": "ScoreSubmitted",
        "type": "event"
    },
    {
        "inputs": [
            { "internalType": "uint256", "name": "score", "type": "uint256" },
            { "internalType": "bytes32", "name": "gameId", "type": "bytes32" }
        ],
        "name": "submitScore",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
] as const;
