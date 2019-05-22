/**
 * @file
 *
 * Test Auto withdraw associated methods and functionalities.
 *
 */
const {
  withdrawTimeLimitThreshold,
  getEventOfType,
  increaseTimeAsync,
  contractCallMethod,
  bidGasPrice,
  getTestrpcParticipantAcc,
  expectRevertAsync,
} = require('./utils')();

const Quantum = artifacts.require('./Quantum.sol');
  
contract('Quantum', function (accounts) {
  const participantAcc = getTestrpcParticipantAcc(accounts);
  const participantDepositAmount = 5; // ether
  let inst;
  let participantBalance = 0;

  describe('Withdraw WWW contract functionality', () => {
    before(async function () {
      inst = await Quantum.deployed();
    });
    
    it('withdraw method raises revert for 0 value deposits', async function () {
      await expectRevertAsync(inst.withdraw(participantAcc, {
        from: participantAcc,
        gasPrice: bidGasPrice,
      })
      );
    });

    it('Deposit should work', async function () {
      participantBalance = await web3.eth.getBalance(participantAcc);
      const participantInitialBalance = participantBalance;

      const depositResult = await contractCallMethod(inst, 'deposit', {
        from: participantAcc,
        value: web3.utils.toWei(
          web3.utils.toBN(participantDepositAmount).toString(),
          'ether'
        ),
        gasPrice: bidGasPrice,
      });
      
      assert.notEqual(
        getEventOfType(depositResult.logs, 'Deposit'),
        null,
        'Deposit event was fired'
      );

      const depositsResult = await inst.deposits(participantAcc);
      // check getDeposit function when withdraw not initiated - it must return the deposited amount
      const userDeposit = await inst.getDeposit.call(participantAcc);

      assert.equal(
        userDeposit.toString(),
        web3.utils.toWei(
          participantDepositAmount.toString(),
          'ether'
        ),
        'participantAcc does not have the expected deposit value when calling getDeposit.'
      );
           
      assert.equal(
        depositsResult.toString(),
        web3.utils.toWei(
          participantDepositAmount.toString(),
          'ether'
        ),
        'participantAcc does not have the expected deposit value.'
      );
      
      participantBalance = await web3.eth.getBalance(participantAcc);

      let gasCost = web3.utils.toBN(depositResult.receipt.cumulativeGasUsed.toString())
        .mul(web3.utils.toBN(bidGasPrice.toString()));
      
      let participantDepositAmountWei = web3.utils.toWei(
        participantDepositAmount.toString(),
        'ether'
      );

      let participantCostPartial = gasCost.add(web3.utils.toBN(participantDepositAmountWei.toString()));
      let participantCostTotal = web3.utils.toBN(participantBalance).add(participantCostPartial);

      assert.equal(
        participantInitialBalance,
        participantCostTotal.toString(),
        'participant wallet balance is not correct after deposit'
      );
    });

    it('Init withdraw should work correct', async function () {
      const initWithdrawResult = await contractCallMethod(inst, 'initWithdraw', {
        from: participantAcc,
        gasPrice: bidGasPrice,
      });

      assert.equal(initWithdrawResult.receipt.status, 1);
      const withdrawMap = await inst.withdrawMap(participantAcc);
      assert.equal(withdrawMap[0].toString(), '1');

      // check getDeposit function when withdraw initiated - it must return value zero
      const userGetDeposit = await inst.getDeposit.call(participantAcc);
      
      assert.equal(
        userGetDeposit.toString(),
        web3.utils.toBN(0).toString(),
        'getDeposit should return 0 when called and withdraw initiated'
      );

      const withdrawInfo = await inst.getWithdrawInfo.call(participantAcc);
      const depositsResult = await inst.deposits(participantAcc);

      assert.equal(
        withdrawInfo[0].toString(),
        depositsResult.toString(),
        'the amount to withdraw must match the deposited value'
      );

      assert.equal(
        withdrawInfo[1].toString(),
        withdrawMap[0].toString(),
        'the withdraw flag must be set after init withdraw'
      );
    });

    it('Deposit should not be possible while withdraw intiated', async function () {
      await expectRevertAsync(inst.deposit({
        from: participantAcc,
        value: web3.utils.toWei(
          web3.utils.toBN(participantDepositAmount).toString(), 'ether'),
        gasPrice: bidGasPrice,
      }));
    });

    it('Withdraw method works correct', async function () {
      const participantBalanceBeforeWithdraw = await web3.eth.getBalance(participantAcc);
      const participantDepositBeforeWithdraw = await inst.deposits(participantAcc);
      const withdrawTimeLimit = await inst.withdrawTimeLimit();
      const withdrawTimeLimitThresholdBN = web3.utils.toBN(withdrawTimeLimitThreshold);

      await increaseTimeAsync(withdrawTimeLimit.add(withdrawTimeLimitThresholdBN).toString());

      const withdrawResult = await inst.withdraw(participantAcc, { gasPrice: bidGasPrice, from: participantAcc });
      assert.equal(withdrawResult.receipt.status, 1, 'autowithdraw transaction failed, tx_status = 0');

      assert.notEqual(
        getEventOfType(withdrawResult.logs, 'WithdrawDeposit'),
        null,
        'WithdrawDeposit event was not fired'
      );
      
      const participantDepositAfterWithdraw = await inst.deposits(participantAcc);

      assert.equal(participantDepositAfterWithdraw.toString(), 0, 'Deposit was not consumed');

      const participantBalanceAfterWithdraw = await web3.eth.getBalance(participantAcc);

      let gasCost = web3.utils.toBN(withdrawResult.receipt.cumulativeGasUsed)
        .mul(web3.utils.toBN(bidGasPrice));
      
      assert.equal(
        participantBalanceAfterWithdraw,
        web3.utils.toBN(participantBalanceBeforeWithdraw)
          .add(participantDepositBeforeWithdraw)
          .sub(gasCost)
          .toString(),
        'Participant wallet balance is not correct after withdraw'
      );

      const withdrawInfo = await inst.getWithdrawInfo.call(participantAcc);

      assert.equal(
        withdrawInfo[1].toString(),
        0,
        'withdrawed flag not reseted to 0 after withdraw'
      );

      assert.equal(
        withdrawInfo[2].toString(),
        withdrawTimeLimit,
        'withdraw timestamp must equal withdraw time limit constant'
      );
    });
  });
});
