pragma solidity ^0.4.25;


contract AbstractPaymentQuantum {

    address public platform;
    address public wallet;
    address public signer;
    address public newPlatform;
    address public newWallet;
    address public newSigner;
    uint public newPlatformRate = 0;
    uint public newWithdrawTimeLimit = 0;
    uint public platformChangeRequestTime = 0;
    uint public walletChangeRequestTime = 0;
    uint public signerChangeRequestTime = 0;
    uint public withdrawTimeLimitChangeTime = 0;
    uint public platformRateChangeTime = 0;
    uint public platformRate = 10; // percent
    uint public withdrawTimeLimit = 240; // use for testing
    uint public platformActionTimeLimit = 5; // use for testing
    // uint public withdrawTimeLimit = 600; // seconds
    // uint public platformActionTimeLimit = 86400; // seconds

    mapping (address => uint) public platformFee;
    mapping (address => uint) public deposits;

    modifier onlyBy(address _account) {
        require(msg.sender == _account);
        _;
    }
     
    event Deposit(address indexed _participant, uint _amount, uint _time);
    event Payment(address indexed _to, uint _amount, uint _time);
    //event Platform(address indexed _platform, bytes32 _action, uint _value, address _signer, uint _time);
    event PlatformChangeInit(address _newAddress, uint _time);
    event PlatformChangeCommit(address _newAddress, uint _time);
    event WalletChangeInit(address _newAddress, uint _time);
    event WalletChangeCommit(address _newAddress, uint _time);
    event SignerChangeInit(address _newAddress, uint _time);
    event SignerChangeCommit(address _newAddress, uint _time);
    event WithdrawTimeLimitChangeInit(uint _timeLimit, uint _time);
    event WithdrawTimeLimitChangeCommit(uint _timeLimit, uint _time);
    event PlatformRateChangeInit(uint _newRate, uint _time);
    event PlatformRateChangeCommit(uint _newRate, uint _time);

    function deposit() public payable returns (uint);

    /**
     * @dev Initiate the platform change by setting the timer and the new value in a temporary variable
     * @param _platform New platform address
     * @return platform address
     */
    function initPlatformChange(address _platform)
        public
        onlyBy(platform)
        returns (address)
    {
        require(_platform != platform);
        require(_platform != newPlatform);

        newPlatform = _platform;
        // solium-disable-next-line security/no-block-members
        platformChangeRequestTime = now + platformActionTimeLimit;
        // solium-disable-next-line security/no-block-members
        emit PlatformChangeInit(newPlatform, now);

        return platform;
    }

    /**
     * @dev Applies the change of the platform address with the value stored in newPlatform temporary variable 
     * @return The platform address
     */
    function commitPlatformChange()
        public
        onlyBy(newPlatform)
        returns (address)
    {
        require(newPlatform != address(0));
        require(platformChangeRequestTime > 0);
        // solium-disable-next-line security/no-block-members
        require(now > platformChangeRequestTime);

        platform = newPlatform;
        newPlatform = address(0);
        platformChangeRequestTime = 0;
        // solium-disable-next-line security/no-block-members
        emit PlatformChangeCommit(platform, now);

        return platform;
    }

    /**
     * @dev Initiate the wallet change by setting the timer and new value in a temporary variable
     * @param _wallet New wallet address
     * @return New wallet address from temporary variable
    */
    function initWalletChange(address _wallet)
        public
        onlyBy(platform)
        returns (address)
    {
        require(_wallet != wallet);
        require(_wallet != newWallet);

        newWallet = _wallet;
        // solium-disable-next-line security/no-block-members
        walletChangeRequestTime = now + platformActionTimeLimit;
        // solium-disable-next-line security/no-block-members
        emit WalletChangeInit(newWallet, now);

        return newWallet;
    }

    /**
     * @dev Applies the change of the wallet address with the value stored in newWallet temporary variable 
     * @return The platform address
     */
    function commitWalletChange()
        public
        onlyBy(platform)
        returns (address)
    {
        require(newWallet != address(0));
        require(walletChangeRequestTime > 0);
        // solium-disable-next-line security/no-block-members
        require(now > walletChangeRequestTime);

        wallet = newWallet;
        newWallet = address(0);
        walletChangeRequestTime = 0;
        // solium-disable-next-line security/no-block-members
        emit WalletChangeCommit(wallet, now);

        return wallet;
    }

    /**
     * @dev Initiate the platform rate change by setting the timer and new value in a temporary variable
     * @param _rate New rate value
     * @return New rate value stored in the temporary variable
     */
    function initChangePlatformRate(uint _rate)
        public
        onlyBy(platform)
        returns (uint)
    {
        require(_rate != platformRate);
        require(_rate != newPlatformRate);
        require(_rate <= 100);
        require(_rate >= 0);

        newPlatformRate = _rate;
        // solium-disable-next-line security/no-block-members
        platformRateChangeTime = now + platformActionTimeLimit;
        // solium-disable-next-line security/no-block-members
        emit PlatformRateChangeInit(newPlatformRate, now);

        return newPlatformRate;
    }

    /**
     * @dev Applies the change of the platform rate with the value stored in newPlatformRate temporary variable
     * @return The platform rate
     */
    function commitChangePlatformRate()
        public
        onlyBy(platform)
        returns (uint)
    {
        require(newPlatformRate >= 0);
        require(platformRateChangeTime > 0);
        // solium-disable-next-line security/no-block-members
        require(now > platformRateChangeTime);

        platformRate = newPlatformRate;
        newPlatformRate = 0;
        platformRateChangeTime = 0;
        // solium-disable-next-line security/no-block-members
        emit PlatformRateChangeCommit(platformRate, now);

        return platformRate;
    }

    /**
     * @dev Initiate the withdraw time limit change by setting the timer and new value in a temporary variable
     * @param _timeLimit New withdraw time limit value in seconds 
     * @return New withdraw time limit
     */
    function initChangeWithdrawLimit(uint _timeLimit)
        public
        onlyBy(platform)
        returns (uint)
    {
        require(_timeLimit != withdrawTimeLimit);
        require(_timeLimit != newWithdrawTimeLimit);
        require(_timeLimit >= 600);
        require(_timeLimit <= 86400);

        newWithdrawTimeLimit = _timeLimit;
        // solium-disable-next-line security/no-block-members
        withdrawTimeLimitChangeTime = now + platformActionTimeLimit;
        // solium-disable-next-line security/no-block-members
        emit WithdrawTimeLimitChangeInit(newWithdrawTimeLimit, now);

        return newWithdrawTimeLimit;
    }

    /**
     * @dev Applies the change of withdraw limit value with the value stored in newWithdrawTimeLimit temporary variable
     * @return The withdraw time limit
     */
    function commitChangeWithdrawLimit()
        public
        onlyBy(platform)
        returns (uint)
    {
        require(newWithdrawTimeLimit > 0);
        require(withdrawTimeLimitChangeTime > 0);
        // solium-disable-next-line security/no-block-members
        require(now > withdrawTimeLimitChangeTime);

        withdrawTimeLimit = newWithdrawTimeLimit;
        newWithdrawTimeLimit = 0;
        withdrawTimeLimitChangeTime = 0;
        // solium-disable-next-line security/no-block-members
        emit WithdrawTimeLimitChangeCommit(withdrawTimeLimit, now);

        return withdrawTimeLimit;
    }
    
    /**
     * @dev Initiate the signer address change by setting the timer and new value in a temporary variable 
     * @param _signer New signer address
     * @return New signer address stored in the temporary variable
     */
    function initChangeSigner(address _signer)
        public
        onlyBy(platform)
        returns (address)
    {
        require(_signer != signer);
        require(_signer != newSigner);

        newSigner = _signer;
        // solium-disable-next-line security/no-block-members
        signerChangeRequestTime = now + platformActionTimeLimit;
        // solium-disable-next-line security/no-block-members
        emit SignerChangeInit(newSigner, now);

        return newSigner;
    }

    /**
     * @dev Applies the change of signer address with the one stored in newSigner temporary variable
     * @return The signer address
     */
    function commitChangeSigner()
        public
        onlyBy(platform)
        returns (address)
    {
        require(newSigner != address(0));
        require(signerChangeRequestTime > 0);
        // solium-disable-next-line security/no-block-members
        require(now > signerChangeRequestTime);

        signer = newSigner;
        newSigner = address(0);
        signerChangeRequestTime = 0;
        // solium-disable-next-line security/no-block-members
        emit SignerChangeCommit(signer, now);

        return signer;
    }
    
    /**
     * @dev Transfer to platform wallet the collected fees
     * @return Balance of platform fee wallet
    */
    function payPlatform()
        public
        onlyBy(platform)
        returns (uint)
    {
        uint fee = platformFee[wallet];
        platformFee[wallet] = 0;

        wallet.transfer(fee);

        // solium-disable-next-line security/no-block-members
        emit Payment(wallet, fee, now);
        return platformFee[wallet];
    }

     /**
     * @dev Add fee to platform collectiong deposit
     * @param _amount KP's fee revenue
     * @return Current platform collected fee in platform deposit
    */
    function collectPlatformFee(uint _amount)
        internal
        returns (uint)
    {
        uint fee = (_amount * platformRate) / 100;
        platformFee[wallet] += fee;
        return platformFee[wallet];
    }

    /**
     * @dev Transfer KP's fee revenue
     * @param _kp KP address
     * @param _amount Fee
     * @return True transfer succeedeed
    */
    function payKp(address _kp, uint _amount)
        internal
        returns (bool)
    {
        _kp.transfer(_amount);
        // solium-disable-next-line security/no-block-members
        emit Payment(_kp, _amount, now);
        return true;
    }
}
