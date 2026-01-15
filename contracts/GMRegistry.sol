// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract GMRegistry {
    mapping(address => uint256) public lastGMTime;
    mapping(address => uint256) public streaks;

    event GMSent(address indexed player, uint256 streak, uint256 timestamp);

    function gm() external {
        uint256 last = lastGMTime[msg.sender];
        uint256 currentStreak = streaks[msg.sender];

        // Logic:
        // 1. If never GM'd or > 48 hours since last, Reset to 1.
        // 2. If > 24 hours since last (but < 48), Increment.
        // 3. If < 24 hours, Revert (cooldown).

        if (last == 0 || block.timestamp > last + 48 hours) {
            currentStreak = 1;
        } else if (block.timestamp > last + 24 hours) {
            currentStreak++;
        } else {
            revert("GM cooldown active (24h)");
        }

        lastGMTime[msg.sender] = block.timestamp;
        streaks[msg.sender] = currentStreak;

        emit GMSent(msg.sender, currentStreak, block.timestamp);
    }

    function getStreak(address player) external view returns (uint256 count, uint256 last, bool canGM) {
        count = streaks[player];
        last = lastGMTime[player];
        
        // If > 48 hours passed, streak is technically 0 (will reset on next tx)
        if (block.timestamp > last + 48 hours) {
            count = 0;
        }

        canGM = (block.timestamp > last + 24 hours);
    }
}
