// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title PvPRegistry
 * @notice Manages PvP game pools, funding, settlement, and extra lives.
 * @dev Hardened with TVL Surplus Accounting to preventing admin-rug of active games.
 */
contract PvPRegistry {
    /// @notice Base USDC Address
    IERC20 public constant USDC = IERC20(0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913);
    
    /// @notice Protocol Owner / Controller
    address public constant OWNER = 0x6edd22E9792132614dD487aC6434dec3709b79A8;
    
    /// @notice Entry Fee (Min 1 USDC)
    uint256 public constant MIN_ENTRY_FEE = 1000000;

    /// @notice Revive Fee (1 USDC)
    uint256 public constant REVIVE_FEE = 1000000;

    /// @notice Safety Timeout: If game is ACTIVE > 24h, players can refund.
    uint256 public constant GAME_TIMEOUT = 24 hours;

    enum GameState { OPEN, ACTIVE, COMPLETED, CANCELLED, REFUNDED }

    struct Game {
        address creator;
        address opponent;
        address winner;
        GameState state;
        uint256 totalPool;
        uint256 betAmount;
        uint256 createdAt;
        uint256 startedAt; // Time when state became ACTIVE
    }

    uint256 public gameIdCounter;
    
    /// @notice Tracks total funds belonging to users in active/open games.
    /// @dev Used to calculate 'surplus' for emergency withdraw.
    uint256 public totalValueLocked;

    mapping(uint256 => Game) public games;
    mapping(uint256 => mapping(address => bool)) public hasRevived;

    // Security Reentrancy Guard
    uint256 private _status;

    event GameCreated(uint256 indexed gameId, address indexed creator, uint256 amount);
    event GameJoined(uint256 indexed gameId, address indexed opponent);
    event GameSettled(uint256 indexed gameId, address indexed winner, uint256 payout);
    event GameCancelled(uint256 indexed gameId, address indexed creator);
    event GameRefunded(uint256 indexed gameId, address creator, uint256 refundCreator, address opponent, uint256 refundOpponent);
    event RevivePurchased(uint256 indexed gameId, address indexed player);
    event EmergencyWithdraw(address indexed owner, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == OWNER, "Not Authorized");
        _;
    }

    modifier nonReentrant() {
        require(_status != 2, "ReentrancyGuard: reentrant call");
        _status = 2;
        _;
        _status = 1;
    }

    modifier validGame(uint256 _gameId) {
        require(_gameId < gameIdCounter, "Invalid Game ID");
        require(games[_gameId].creator != address(0), "Game Not Initialized");
        _;
    }

    constructor() {
        _status = 1;
    }

    /**
     * @notice Create a new PvP Game (Table) with a custom wager.
     * @param amount The amount of USDC to wager (min 5 USDC).
     */
    function createGame(uint256 amount) external nonReentrant {
        require(amount >= MIN_ENTRY_FEE, "Min Wager 1 USDC");

        // Checks
        uint256 balanceBefore = USDC.balanceOf(address(this));
        
        // Transfer wager from creator to contract
        bool success = USDC.transferFrom(msg.sender, address(this), amount);
        require(success, "USDC Transfer Failed");
        
        // Effects
        uint256 balanceAfter = USDC.balanceOf(address(this));
        require(balanceAfter == balanceBefore + amount, "Deflationary Token Not Supported");

        totalValueLocked += amount;

        uint256 newGameId = gameIdCounter++;
        
        games[newGameId] = Game({
            creator: msg.sender,
            opponent: address(0),
            winner: address(0),
            state: GameState.OPEN,
            totalPool: amount,
            betAmount: amount,
            createdAt: block.timestamp,
            startedAt: 0
        });

        emit GameCreated(newGameId, msg.sender, amount);
    }

    /**
     * @notice Join an existing open game.
     * @notice Transfers the required wager amount from joiner.
     * @param _gameId The ID of the game to join.
     */
    function joinGame(uint256 _gameId) external nonReentrant validGame(_gameId) {
        Game storage game = games[_gameId];
        require(game.state == GameState.OPEN, "Game not open");
        require(msg.sender != game.creator, "Cannot play against self");

        uint256 wager = game.betAmount;

        // Transfer matching wager from joiner
        bool success = USDC.transferFrom(msg.sender, address(this), wager);
        require(success, "USDC Transfer Failed");

        // State Updates
        totalValueLocked += wager;
        
        game.opponent = msg.sender;
        game.state = GameState.ACTIVE;
        game.totalPool += wager; 
        game.startedAt = block.timestamp; // Start the timer for timeout

        emit GameJoined(_gameId, msg.sender);
    }

    /**
     * @notice Buy an extra life for 1 USDC.
     * @notice Can only be purchased once per game per player.
     * @dev Sends fee DIRECTLY to Owner to avoid mixing with game pools.
     * @param _gameId The ID of the game.
     */
    function buyRevive(uint256 _gameId) external nonReentrant validGame(_gameId) {
        Game storage game = games[_gameId];
        require(game.state == GameState.ACTIVE, "Game not active");
        require(msg.sender == game.creator || msg.sender == game.opponent, "Not a player");
        require(!hasRevived[_gameId][msg.sender], "Already revived once");

        // Transfer 1 USDC directly to Owner (Revenue)
        // Does NOT affect TVL or Contract Balance
        bool success = USDC.transferFrom(msg.sender, OWNER, REVIVE_FEE);
        require(success, "Revive Payment Failed");

        hasRevived[_gameId][msg.sender] = true;

        emit RevivePurchased(_gameId, msg.sender);
    }

    /**
     * @notice Cancel a game if no opponent has joined yet.
     * @notice Refunds the wager to the creator.
     * @param _gameId The ID of the game to cancel.
     */
    function cancelGame(uint256 _gameId) external nonReentrant validGame(_gameId) {
        Game storage game = games[_gameId];
        require(game.creator == msg.sender, "Not creator");
        require(game.state == GameState.OPEN, "Cannot cancel active/closed game");
        require(block.timestamp >= game.createdAt + 1 hours, "Review Period Active (1h)");

        uint256 refundAmount = game.totalPool;
        
        // State Changes
        game.state = GameState.CANCELLED;
        totalValueLocked -= refundAmount;

        // Interaction
        bool success = USDC.transfer(msg.sender, refundAmount);
        require(success, "Refund Failed");

        emit GameCancelled(_gameId, msg.sender);
    }

    /**
     * @notice SAFETY VALVE: If game is ACTIVE but not settled for > 24 hours.
     * @notice Either player can call this to trigger a 50/50 split refund.
     * @param _gameId The ID of the game.
     */
    function refundStaleGame(uint256 _gameId) external nonReentrant validGame(_gameId) {
        Game storage game = games[_gameId];
        require(game.state == GameState.ACTIVE, "Game not active");
        require(block.timestamp >= game.startedAt + GAME_TIMEOUT, "Game not yet timed out");
        require(msg.sender == game.creator || msg.sender == game.opponent, "Not a player");

        uint256 total = game.totalPool;
        uint256 share1 = total / 2;
        uint256 share2 = total - share1; // Deterministic remainder handling (0 for even bets)

        // State Changes
        game.state = GameState.REFUNDED;
        totalValueLocked -= total;

        // Interactions
        require(USDC.transfer(game.creator, share1), "Refund Creator Failed");
        require(USDC.transfer(game.opponent, share2), "Refund Opponent Failed");

        emit GameRefunded(_gameId, game.creator, share1, game.opponent, share2);
    }

    /**
     * @notice Settle a game by declaring a winner.
     * @notice 80% to Winner, 20% to Protocol.
     * @notice Only callable by OWNER/Controller.
     * @param _gameId The ID of the game to settle.
     * @param _winner The address of the winner.
     */
    function settleGame(uint256 _gameId, address _winner) external onlyOwner nonReentrant validGame(_gameId) {
        Game storage game = games[_gameId];
        require(game.state == GameState.ACTIVE, "Game not active");
        require(_winner == game.creator || _winner == game.opponent, "Invalid winner");

        game.winner = _winner;
        game.state = GameState.COMPLETED;

        uint256 total = game.totalPool;
        totalValueLocked -= total; // Release locked info

        uint256 protocolFee = (total * 20) / 100; // 20%
        uint256 payout = total - protocolFee; // 80%

        // Interactions
        require(USDC.transfer(_winner, payout), "Payout Transfer Failed");
        require(USDC.transfer(OWNER, protocolFee), "Fee Transfer Failed");

        emit GameSettled(_gameId, _winner, payout);
    }

    /**
     * @notice Emergency Withdraw Surplus.
     * @dev Can ONLY withdraw funds that are NOT currently locked in games.
     * @dev This protects user funds from being rugged by the owner.
     */
    function emergencyWithdraw(uint256 amount) external onlyOwner nonReentrant {
        uint256 currentBalance = USDC.balanceOf(address(this));
        
        // Calculate Surplus (Real Balance - User Locked Funds)
        require(currentBalance >= totalValueLocked, "Accounting Error: Balance < TVL");
        uint256 surplus = currentBalance - totalValueLocked;

        require(amount <= surplus, "Cannot withdraw User Funds");

        bool success = USDC.transfer(OWNER, amount);
        require(success, "Transfer Failed");
        
        emit EmergencyWithdraw(OWNER, amount);
    }
}
