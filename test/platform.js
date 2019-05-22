/**
 * @file
 *
 * Test platform associated methods and functionalities.
 *
 */
const {
  expectRevertAsync,
  getEventOfType,
  contractCallMethod,
  bidGasPrice,
  validateTestrpcAccountsSetup,
  getTestrpcParticipantAcc,
  getTestrpcNewPlatformAcc,
  getTestrpcNewWalletAcc,
  mineSingleBlockAsync,
  withdrawTimeLimitThreshold,
  increaseTimeAsync,
} = require('./utils')();
  
const deployParams = require('../config/deploy_params');
const Quantum = artifacts.require('./Quantum.sol');
  
contract('Quantum', function (accounts) {
  let ownerAddr = deployParams.development.ownerAddr;
  let walletAddr = deployParams.development.walletAddr;
  let inst;
  const participantAcc = getTestrpcParticipantAcc(accounts);
  const newPlatformAcc = getTestrpcNewPlatformAcc(accounts);
  const newWalletAcc = getTestrpcNewWalletAcc(accounts);
  const newSignerAddr = accounts[2];
  
  describe('platform based functionality', () => {
    before(async function () {
      inst = await Quantum.deployed();
    });

    it('ensure test setup is correct', async function () {
      validateTestrpcAccountsSetup(accounts);
    });
  
    it('non-platform accounts should not be allowed to change contract settings', async function () {
      await expectRevertAsync(inst.initChangePlatformRate('3', {
        from: participantAcc,
        gasPrice: bidGasPrice,
      }));
      await expectRevertAsync(inst.commitChangePlatformRate({
        from: participantAcc,
        gasPrice: bidGasPrice,
      }));
      await expectRevertAsync(inst.initWalletChange(participantAcc, {
        from: participantAcc,
        gasPrice: bidGasPrice,
      }));
      await expectRevertAsync(inst.commitWalletChange({
        from: participantAcc,
        gasPrice: bidGasPrice,
      }));
      await expectRevertAsync(inst.initChangeWithdrawLimit('1000', {
        from: participantAcc,
        gasPrice: bidGasPrice,
      }));
      await expectRevertAsync(inst.commitChangeWithdrawLimit({
        from: participantAcc,
        gasPrice: bidGasPrice,
      }));
      await expectRevertAsync(inst.commitChangeSigner({
        from: participantAcc,
        gasPrice: bidGasPrice,
      }));
      await expectRevertAsync(inst.payPlatform({
        from: participantAcc,
        gasPrice: bidGasPrice,
      }));
    });
  
    it('it should be possible for platform to call payPlatform', async function () {
      const result = await contractCallMethod(inst, 'payPlatform', {
        from: ownerAddr,
        gasPrice: bidGasPrice,
      });
      assert.notEqual(
        getEventOfType(result.logs, 'Payment'),
        null,
        'Payment event was fired'
      );
      const resultLogs = result.logs[0];
      assert.equal(
        resultLogs.type,
        'mined'
      );

      assert.equal(
        resultLogs.args._to,
        web3.utils.toChecksumAddress(walletAddr),
        'Transfer was sent to wallet address'
      );

      assert.equal(
        resultLogs.args._amount,
        '0'
      );
    });

    it('it should not be possible to change platform rate to over 100', async function () {
      for (let expectedPlatformRate = 101; expectedPlatformRate <= 102; expectedPlatformRate++) {
        const platformRateOriginal = await inst.platformRate();
        const newPlatformRateOriginal = await inst.newPlatformRate();
        const platformRateChangeRequestValOriginal = await inst.platformRateChangeTime();
        
        await expectRevertAsync(inst.initChangePlatformRate('' + expectedPlatformRate, {
          from: ownerAddr,
          gasPrice: bidGasPrice,
        }));
  
        const platformRate = await inst.platformRate();
        const newPlatformRate = await inst.newPlatformRate();
        const platformRateChangeRequestVal = await inst.platformRateChangeTime();

        assert.equal(platformRate.toString(), platformRateOriginal.toString());

        assert.equal(
          platformRateChangeRequestVal.toString(),
          platformRateChangeRequestValOriginal.toString(),
          'platform rate change request must not change when rate value is greater than 100'
        );

        assert.equal(
          newPlatformRate.toString(),
          newPlatformRateOriginal.toString(),
          'new platform rate value must not be set'
        );
      }
    });
    
    it('it should not be possible to change platform rate to the same value', async function () {
      const platformRateOriginal = await inst.platformRate();
      const platformRateChangeRequestValOriginal = await inst.platformRateChangeTime();

      await expectRevertAsync(inst.initChangePlatformRate(platformRateOriginal, {
        from: ownerAddr,
        gasPrice: bidGasPrice,
      }));
      
      const platformRate = await inst.platformRate();
      const platformRateChangeRequestVal = await inst.platformRateChangeTime();

      assert.equal(platformRate.toString(), platformRateOriginal.toString());
      assert.equal(
        platformRateChangeRequestVal.toString(),
        platformRateChangeRequestValOriginal.toString(),
        'platform rate change request must not change when using the same value'
      );
    });
    
    it('init platform rate change should set the new value and the timer', async function () {
      const platformRateOriginal = await inst.platformRate();
      const newPlatformRateOriginal = await inst.newPlatformRate();

      let newPlatformRateRandom = Math.floor(Math.random() * 101);
      do {
        newPlatformRateRandom = Math.floor(Math.random() * 101);
      }
      while (newPlatformRateRandom === platformRateOriginal);

      await inst.initChangePlatformRate(newPlatformRateRandom, {
        from: ownerAddr,
        gasPrice: bidGasPrice,
      });

      const platformRateChangeRequestVal = await inst.platformRateChangeTime();
      const platformRateAfterFirstChangeCall = await inst.platformRate();
      const newPlatformRate = await inst.newPlatformRate();
      
      assert(
        platformRateChangeRequestVal.toString() > 0,
        'platform rate change timer should be set'
      );

      assert.equal(
        platformRateOriginal.toString(),
        platformRateAfterFirstChangeCall.toString(),
        'platform rate must not change when init'
      );

      assert.notEqual(
        newPlatformRateOriginal.toString(),
        newPlatformRate.toString(),
        'temporary platform rate must be set'
      );

      assert.equal(
        newPlatformRate.toString(),
        newPlatformRateRandom,
        'temporary platform rate must be set with new value'
      );
    });
    
    it('platform rate should change after security time interval passed', async function () {
      const platformActionTimeLimit = await inst.platformActionTimeLimit();
      const newPlatformRateOriginal = await inst.newPlatformRate();

      const withdrawTimeLimitThresholdBN = web3.utils.toBN(withdrawTimeLimitThreshold);
      await increaseTimeAsync(platformActionTimeLimit.add(withdrawTimeLimitThresholdBN).toString());

      const result = await inst.commitChangePlatformRate({
        from: ownerAddr,
        gasPrice: bidGasPrice,
      });

      assert.notEqual(
        getEventOfType(result.logs, 'PlatformRateChangeCommit'),
        null,
        'PlatformRateChangeCommit event was fired'
      );
      
      const resultLogs = result.logs[0];
      assert.equal(
        resultLogs.type,
        'mined'
      );

      const platformRateChanged = await inst.platformRate();
      const platformRateChangeRequestValChanged = await inst.platformRateChangeTime();
      const newPlatformRateAfterChange = await inst.newPlatformRate();

      assert.equal(
        platformRateChanged.toString(),
        newPlatformRateOriginal,
        'platform rate should have the new value'
      );

      assert.equal(
        newPlatformRateAfterChange.toString(),
        0,
        'temporaty platform rate parameter value must reset to 0'
      );

      assert.equal(
        platformRateChangeRequestValChanged.toString(),
        0,
        'platform rate change request parameter value must reset to 0'
      );
    });
    
    /** WITHDRAW TIME LIMIT */
    it('init withdraw time limit change should set the new value and the timer', async function () {
      const withdrawTimeLimitOriginal = await inst.withdrawTimeLimit();

      const result = await inst.initChangeWithdrawLimit(600, {
        from: ownerAddr,
        gasPrice: bidGasPrice,
      });

      const withdrawTimeLimitChangeRequestVal = await inst.withdrawTimeLimitChangeTime();
      const withdrawTimeLimitAfterFirstChangeCall = await inst.withdrawTimeLimit();
      const newWithdrawTimeLimit = await inst.newWithdrawTimeLimit();

      assert(
        withdrawTimeLimitChangeRequestVal.toString() > 0,
        'withdraw time limit change request parameter must be set after calling function'
      );

      assert.equal(
        newWithdrawTimeLimit.toString(),
        600,
        'temporary withdraw time limit must be set'
      );

      assert.equal(
        withdrawTimeLimitOriginal.toString(),
        withdrawTimeLimitAfterFirstChangeCall.toString(),
        'withdraw time limit must not change when setting request change time parameter'
      );

      assert.notEqual(
        getEventOfType(result.logs, 'WithdrawTimeLimitChangeInit'),
        null,
        'WithdrawTimeLimitChangeInit event must be tfired'
      );

      const resultLogs = result.logs[0];
      assert.equal(
        resultLogs.type,
        'mined'
      );
    });
    /** END WITHDRAW TIME LIMIT */

    /** SIGNER */
    it('init signer address change should set the temporary new value and the timer', async function () {
      const result = await inst.initChangeSigner(newSignerAddr, {
        from: ownerAddr,
        gasPrice: bidGasPrice,
      });

      const signerChangeRequestTimeVal = await inst.signerChangeRequestTime();
      const newSigner = await inst.newSigner();
      assert(
        signerChangeRequestTimeVal.toString() > 0,
        'signer address change request timer must be set after calling function'
      );
      
      assert.equal(
        newSigner.toString(),
        web3.utils.toChecksumAddress(newSignerAddr),
        'temporary signer address must be set'
      );

      assert.notEqual(
        getEventOfType(result.logs, 'SignerChangeInit'),
        null,
        'SignerChangeInit event must be fired'
      );

      const resultLogs = result.logs[0];
      assert.equal(
        resultLogs.type,
        'mined'
      );
    });
    /** END SIGNER */

    /** WALLET */
    it('init wallet address change should set the temporary new value and the timer', async function () {
      const result = await inst.initWalletChange(newWalletAcc, {
        from: ownerAddr,
        gasPrice: bidGasPrice,
      });

      const walletChangeRequestTimeVal = await inst.walletChangeRequestTime();
      assert(
        walletChangeRequestTimeVal.toString() > 0,
        'wallet address change timer must be set after calling function'
      );
      
      const newWallet = await inst.newWallet();
      assert.equal(
        newWallet,
        web3.utils.toChecksumAddress(newWalletAcc),
        'temporary wallet address must be set'
      );

      assert.notEqual(
        getEventOfType(result.logs, 'WalletChangeInit'),
        null,
        'WalletChangeInit event must be fired'
      );

      const resultLogs = result.logs[0];
      assert.equal(
        resultLogs.type,
        'mined'
      );
    });
    /** END WALLET */

    /** PLATFORM ACCOUNT */
    it('it should not be possible to change platform account with the current one', async function () {
      await expectRevertAsync(inst.initPlatformChange(ownerAddr, {
        from: ownerAddr,
        gasPrice: bidGasPrice,
      }));
    });
    
    it('init platform address change should set the temporary new value and the timer', async function () {
      const result = await inst.initPlatformChange(newPlatformAcc, {
        from: ownerAddr,
        gasPrice: bidGasPrice,
      });

      await mineSingleBlockAsync();

      const platformChangeRequestTimeVal = await inst.platformChangeRequestTime();
      const newPlatform = await inst.newPlatform();
      assert(
        platformChangeRequestTimeVal.toString() > 0,
        'platform account change request parameter must be set after calling function'
      );
      
      assert.equal(
        newPlatform.toString(),
        web3.utils.toChecksumAddress(newPlatformAcc),
        'temporary platform address must be set'
      );
      
      assert.notEqual(
        getEventOfType(result.logs, 'PlatformChangeInit'),
        null,
        'PlatformChangeInit event must be fired'
      );

      const resultLogs = result.logs[0];
      assert.equal(
        resultLogs.type,
        'mined'
      );
    });

    it('commit functions should not be possible before security time has passed', async function () {
      await expectRevertAsync(inst.commitChangePlatformRate({
        from: ownerAddr,
        gasPrice: bidGasPrice,
      }));
      await expectRevertAsync(inst.commitWalletChange({
        from: ownerAddr,
        gasPrice: bidGasPrice,
      }));
      await expectRevertAsync(inst.commitChangeWithdrawLimit({
        from: ownerAddr,
        gasPrice: bidGasPrice,
      }));
      await expectRevertAsync(inst.commitChangeSigner({
        from: ownerAddr,
        gasPrice: bidGasPrice,
      }));
    });

    /** INCREASE TIME */
    it('testrpc increase time', async function () {
      const t1 = await inst.platformActionTimeLimit();
      await increaseTimeAsync(t1.add(web3.utils.toBN('2')).toString());
    });
    /** END INCREASE TIME */

    it('withdraw time limit should change after security time interval passed', async function () {
      const newWithdrawTimeLimit = await inst.newWithdrawTimeLimit();

      const result = await inst.commitChangeWithdrawLimit({
        from: ownerAddr,
        gasPrice: bidGasPrice,
      });
      
      assert.notEqual(
        getEventOfType(result.logs, 'WithdrawTimeLimitChangeCommit'),
        null,
        'WithdrawTimeLimitChangeCommit event must be fired'
      );

      const resultLogs = result.logs[0];

      assert.equal(
        resultLogs.type,
        'mined'
      );

      const withdrawTimeLimitChanged = await inst.withdrawTimeLimit();

      assert.equal(
        withdrawTimeLimitChanged.toString(),
        newWithdrawTimeLimit.toString(),
        'withdraw time limit should have changed to the one stored in the temporary variable'
      );

      const withdrawTimeLimitChangeRequestValChanged = await inst.withdrawTimeLimitChangeTime();
      const newWithdrawTimeLimitAfterChange = await inst.newWithdrawTimeLimit();

      assert.equal(
        newWithdrawTimeLimitAfterChange.toString(),
        0,
        'temporary withdraw time limit must reset to 0'
      );

      assert.equal(
        withdrawTimeLimitChangeRequestValChanged.toString(),
        0,
        'withdraw time limit change timer value must reset to 0'
      );
    });
    
    it('signer address should change after security time interval passed', async function () {
      const newSignerAddrTemp = await inst.newSigner();

      const result = await inst.commitChangeSigner({
        from: ownerAddr,
        gasPrice: bidGasPrice,
      });
    
      assert.notEqual(
        getEventOfType(result.logs, 'SignerChangeCommit'),
        null,
        'SignerChangeCommit event must be fired'
      );

      const resultLogs = result.logs[0];

      assert.equal(
        resultLogs.type,
        'mined'
      );
    
      const signerAddrChanged = await inst.signer();
      const signerChangeRequestTimeVal = await inst.signerChangeRequestTime();
      const newSignerAddrTempAfterChange = await inst.newSigner();
      assert.equal(
        signerAddrChanged.toString(),
        newSignerAddrTemp.toString(),
        'signer address should have the new value'
      );

      assert.equal(
        newSignerAddrTempAfterChange.toString(),
        0,
        'temporary signer address must reset to 0'
      );

      assert.equal(
        signerChangeRequestTimeVal.toString(),
        0,
        'signer address change timer value must reset to 0'
      );
    });
   
    it('wallet address should change after security time interval passed', async function () {
      const newWalletTemp = await inst.newWallet();

      const result = await inst.commitWalletChange({
        from: ownerAddr,
        gasPrice: bidGasPrice,
      });
    
      assert.notEqual(
        getEventOfType(result.logs, 'WalletChangeCommit'),
        null,
        'WalletChangeCommit event must be fired'
      );

      const resultLogs = result.logs[0];

      assert.equal(
        resultLogs.type,
        'mined'
      );
      
      const walletAddrChanged = await inst.wallet();
      const walletChangeRequestTimeVal = await inst.walletChangeRequestTime();
      const newWalletTempAfterChange = await inst.newWallet();

      assert.equal(
        walletAddrChanged.toString(),
        newWalletTemp.toString(),
        'wallet address should have the new value'
      );

      assert.equal(
        newWalletTempAfterChange.toString(),
        0,
        'temporary wallet address must reset to 0'
      );

      assert.equal(
        walletChangeRequestTimeVal.toString(),
        0,
        'wallet address change timer must reset to 0'
      );
    });
    
    it('call change platform with other account than set in temp variable should not be possible', async function () {
      await expectRevertAsync(inst.commitPlatformChange({
        from: ownerAddr,
        gasPrice: bidGasPrice,
      }));
    });

    // this test must be the last in this file
    it('platform account should change after security time interval passed', async function () {
      const newPlatformTemp = await inst.newPlatform();

      const result = await inst.commitPlatformChange({
        from: newPlatformTemp,
        gasPrice: bidGasPrice,
      });
    
      assert.notEqual(
        getEventOfType(result.logs, 'PlatformChangeCommit'),
        null,
        'PlatformChangeCommit event must be fired'
      );

      const resultLogs = result.logs[0];

      assert.equal(
        resultLogs.type,
        'mined'
      );
      
      const platformAddrChanged = await inst.platform();
      const platformChangeRequestTimeVal = await inst.platformChangeRequestTime();
      const newPlatformTempAfterChange = await inst.newPlatform();
    
      assert.equal(
        platformAddrChanged.toString(),
        newPlatformTemp.toString(),
        'platform account should have the new value'
      );

      assert.equal(
        newPlatformTempAfterChange.toString(),
        0,
        'temporary platform address must reset to 0'
      );

      assert.equal(
        platformChangeRequestTimeVal.toString(),
        0,
        'platform account change timer must reset to 0'
      );
    });
  });
});
