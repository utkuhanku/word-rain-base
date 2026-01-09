// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}

/**
 * @title ScoreRegistry
 * @notice Immutable registry for game scores coupled with protocol fee payment.
 */
contract ScoreRegistry {
    /// @notice Base USDC Address
    IERC20 public constant USDC = IERC20(0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913);
    
    /// @notice Game Wallet Recipient
    address public constant RECIPIENT = 0x6edd22E9792132614dD487aC6434dec3709b79A8;
    
    /// @notice Fee Amount (0.15 USDC with 6 decimals)
    uint256 public constant FEE = 150000;

    event ScoreSubmitted(
        address indexed player,
        uint256 score,
        bytes32 gameId,
        uint256 amount,
        uint256 timestamp
    );

    /**
     * @notice Submit a score by paying the fee.
     * @param score The player's score (e.g. WPM or Points).
     * @param gameId Optional identifier for the specific game session.
     */
    function submitScore(uint256 score, bytes32 gameId) external {
        // Attempt to transfer FEE from player to RECIPIENT
        // Player must have approved this contract to spend USDC beforehand
        bool success = USDC.transferFrom(msg.sender, RECIPIENT, FEE);
        require(success, "USDC Payment Failed");
        
        // Emit the permanent record
        emit ScoreSubmitted(msg.sender, score, gameId, FEE, block.timestamp);
    }
}
