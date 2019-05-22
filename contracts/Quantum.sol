pragma solidity ^0.4.25;

import "./AbstractPaymentQuantum.sol";


contract Quantum is AbstractPaymentQuantum {    
    mapping(address => Withdraw) public withdrawMap;
    mapping(uint => mapping(address => uint)) participantPayment;

    struct Withdraw {
        uint8 withdrawed;
        uint time;
    }

    event WithdrawDeposit(address indexed _participant, uint _amount, uint _time);

    event Commit(address indexed _participant,
                address indexed _kp,
                uint _amount,
                uint _remainingValue,
                uint _sessionId,
                uint _time
    );

    modifier isValidAmount(address _participant, uint _amount, uint _sessionId) {
        if (_amount <= participantPayment[_sessionId][_participant]) {
            revert();
        }
        _;
    }

    modifier hasFunds(address _user) {
        if (deposits[_user] == 0) {
            revert();
        }
        _;
    }

    constructor (address _platform, address _wallet, address _signer) public {
        platform = _platform;
        wallet = _wallet;
        signer = _signer;
    }

     /**
     * @dev Deposit funds into the participant account
     * @return Current total amount escrowed for the caller
    */
    function deposit()
        public
        payable
        returns (uint)
    {
        require(withdrawMap[msg.sender].withdrawed == 0);
        deposits[msg.sender] += msg.value;
        // solium-disable-next-line security/no-block-members
        emit Deposit(msg.sender, msg.value, now);

        return deposits[msg.sender];
    }

     /**
     * @dev Get the deposit of a specified member if the withdraw flag is 0 or 0 when the withdraw flag is 1
     * @param _participant Address of the participant
     * @return Amount in wei or 0 when the withdraw flag is 1
    */
    function getDeposit(address _participant)
        public
        view
        returns (uint)
    {
        if (withdrawMap[_participant].withdrawed == 1) {
            return 0;
        } else {
            return (deposits[_participant]);
        }
    }

    /**
     * @dev Get withdraw status
     * @param _user Owner of deposit
    */
    function getWithdrawInfo(address _user)
        public
        view
        returns (uint, uint256, uint)
    {
        return (
            deposits[_user],
            withdrawMap[_user].withdrawed,
            withdrawMap[_user].time + withdrawTimeLimit
        );
    }

    /**
     * @dev Withdraw user deposit
     * @param _user Owner of deposit
     * @return The withdraw flag
    */
    function withdraw(address _user)
        public
        hasFunds(_user)
        returns (uint)
    {
        // solium-disable-next-line security/no-block-members
        if (now > withdrawMap[_user].time && withdrawMap[_user].withdrawed == 1) {
            if (consumeDeposit(_user) == 0) {
                resetWithdraw(_user);
            }
        }
        return withdrawMap[_user].withdrawed;
    }

    /**
     * @dev Initiate withdraw
     * @return The withdraw flag
    */
    function initWithdraw()
        public
        hasFunds(msg.sender)
        returns (uint)
    {
        if (withdrawMap[msg.sender].withdrawed == 0) {
            withdrawMap[msg.sender].withdrawed = 1;
            // solium-disable-next-line security/no-block-members
            withdrawMap[msg.sender].time = now + withdrawTimeLimit;
        }
        return withdrawMap[msg.sender].withdrawed;
    }

    /**
     * @dev Commit session information
     * @param _participant Session participant
     * @param _kp Knowledge provider of the session
     * @param _value Cost to pay for participant for session
     * @param _sessionId Session identifier
     * @param _contract Contract address
     * @param _v array Signature components (_v[0] signed by _participant, _v[1] signed by signer)
     * @param _r array Signature components (_r[0] signed by _participant, _r[1] signed by signer)
     * @param _s array Signature components (_s[0] signed by _participant, _s[1] signed by signer)
     * @return True if all the payment chain succeeded
    */
    function commit(
        address _participant,
        address _kp,
        uint _value,
        uint _sessionId,
        address _contract,
        uint8[2] _v,
        bytes32[2] _r,
        bytes32[2] _s
        )
        public
        isValidAmount(_participant, _value, _sessionId)
        returns (bool)
    {
        require(_contract == address(this));

        if (_participant != ecrecover(keccak256(abi.encodePacked(_sessionId, _participant, _kp, _value, _contract)), _v[0], _r[0], _s[0])) {
            revert();
        }

        if (signer != ecrecover(keccak256(abi.encodePacked(_sessionId, _participant, _kp, _value, _contract)), _v[1], _r[1], _s[1])) {
            revert();
        }

        uint256 remainingValue;
        remainingValue = _value;
        remainingValue -= participantPayment[_sessionId][_participant];

        if (deposits[_participant] < remainingValue) {
            revert();
        }

        deposits[_participant] -= remainingValue;
        participantPayment[_sessionId][_participant] += remainingValue;
        remainingValue -= collectPlatformFee(remainingValue);

        // solium-disable-next-line security/no-block-members
        emit Commit(_participant, _kp, _value, remainingValue, _sessionId, now);
        return payKp(_kp, remainingValue);
    }

    /**
     * @dev only for testing purpose
    */
    function getParticipantPayment(address _participant, uint _sessionId)
        public
        view
        returns (uint)
    {
        return participantPayment[_sessionId][_participant];
    }

    /**
     * @dev Reset withdraw flags
     * @param _user User to reset withdraw
     * @return withdraw status flag
    */
    function resetWithdraw(address _user)
        internal
        returns (uint)
    {
        if (withdrawMap[_user].withdrawed == 1) {
            withdrawMap[_user].withdrawed = 0;
            withdrawMap[_user].time = 0;
        }
        return withdrawMap[_user].withdrawed;
    }

    /**
     * @dev Empty user deposit
     * @param _user Deposit owner
     * @return User deposit balance
     */
    function consumeDeposit(address _user)
        internal
        returns (uint)
    {
        if (deposits[_user] > 0) {

            uint userDeposit = deposits[_user];
            deposits[_user] = 0;
            _user.transfer(userDeposit);
            // solium-disable-next-line security/no-block-members
            emit WithdrawDeposit(_user, userDeposit, now);
        }
        return deposits[_user];
    }
}
