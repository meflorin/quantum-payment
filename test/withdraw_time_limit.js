/**
 * @file
 *
 * Test withdraw time limit associated methods and functionalities.
 *
 */
const {
  expectRevertAsync,
  bidGasPrice,
  getTestrpcParticipantAcc,
} = require('./utils')();
    
const deployParams = require('../config/deploy_params');
const Quantum = artifacts.require('./Quantum.sol');
  
contract('Quantum', function (accounts) {
  let ownerAddr = deployParams.development.ownerAddr;
  let inst;
  const participantAcc = getTestrpcParticipantAcc(accounts);
  const minWtl = 600;
  const maxWtl = 86400;
  
  describe('withdraw time limit basic functionality', () => {
    before(async function () {
      inst = await Quantum.deployed();
    });

    it('non-platform accounts should not be allowed to initiate change withdraw time limit', async function () {
      await expectRevertAsync(inst.initChangeWithdrawLimit(1000, {
        from: participantAcc,
        gasPrice: bidGasPrice,
      }));
    });

    it('withdraw time limit change request flag is set to 0 by default', async function () {
      const withdrawTimeLimitChangeRequest = await inst.withdrawTimeLimitChangeTime();
      assert.equal(
        withdrawTimeLimitChangeRequest.toString(),
        0,
        'withdraw time limit change request flag must be 0 by default');
    });
    
    it('changing withdraw time limit to a value less than min accepted - ' + minWtl + ' should reise revert',
      async function () {
        await expectRevertAsync(inst.initChangeWithdrawLimit(599, {
          from: ownerAddr,
          gasPrice: bidGasPrice,
        }));
      });

    it('changing withdraw time limit to a value greater than max accepted - ' + maxWtl + ' should reise revert',
      async function () {
        await expectRevertAsync(inst.initChangeWithdrawLimit(86401, {
          from: ownerAddr,
          gasPrice: bidGasPrice,
        }));
      });
    
    it('it should not be possible to change withdraw time limit value with the existing one', async function () {
      const withdrawTimeLimitOriginal = await inst.withdrawTimeLimit();
      const withdrawTimeLimitChangeRequestValOriginal = await inst.withdrawTimeLimitChangeTime();

      await expectRevertAsync(inst.initChangeWithdrawLimit(withdrawTimeLimitOriginal, {
        from: ownerAddr,
        gasPrice: bidGasPrice,
      }));
      
      const withdrawTimeLimit = await inst.withdrawTimeLimit();
      const withdrawTimeLimitChangeRequestVal = await inst.withdrawTimeLimitChangeTime();

      assert.equal(
        withdrawTimeLimit.toString(),
        withdrawTimeLimitOriginal.toString(),
        'withdraw time limit value must not change when using the same value'
      );

      assert.equal(
        withdrawTimeLimitChangeRequestVal.toString(),
        withdrawTimeLimitChangeRequestValOriginal.toString(),
        'withdraw time limit change request value must not change when using the same value'
      );
    });

    it('non-platform accounts should not be allowed to commit change withdraw time limit', async function () {
      await expectRevertAsync(inst.commitChangeWithdrawLimit({
        from: participantAcc,
        gasPrice: bidGasPrice,
      }));
    });

    it('new withdraw time limit set to zero should not allow to commit change withdraw time limit', async function () {
      await expectRevertAsync(inst.commitChangeWithdrawLimit({
        from: ownerAddr,
        gasPrice: bidGasPrice,
      }));
    });
  });
});
