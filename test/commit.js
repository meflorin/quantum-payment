/**
 * @file
 *
 * Test commit contract method and associated functionality.
 *
 * We test with different contract setup options and by iterating over
 * different scenarios on how one might invoke the commit functionality.
 *
 * For example, given the same session id and:
 *    participant initial deposit:  50,000 wei
 *    platform fees:                1%
 *
 * And we call commit method multiple times then we would expect the
 * following results:
 *
 *    iteration 1:
 *      session cost:               500 wei
 *      platform:                   5 wei
 *      kp:                         495 wei
 *      participant desposit left:  49,500 wei

 *    iteration 2:
 *      session cost:               1000 wei
 *      platform:                   10 wei
 *      kp:                         990 wei
 *      participant desposit left:  49,000 wei

 *    iteration 3:
 *      session cost:               1500 wei
 *      platform:                   15 wei
 *      kp:                         1485 wei
 *      participant desposit left:  48,500 wei
 */

const {
  defaultAccounts,
  contractCallMethod,
  getEventOfType,
  generateSignature,
  concatSigRS,
  concatSigV,
  mineSingleBlockAsync,
  bidGasPrice,
  getTestrpcParticipantAcc,
  getTestrpcKpAcc,
  getTestrpcPpAcc,
  expectRevertAsync,
} = require('./utils')();
const deployParams = require('../config/deploy_params');
const Quantum = artifacts.require('./Quantum.sol');
const BN = require('bn.js');
const BigNumber = require('bignumber.js');

contract('Quantum', function (accounts) {
  const ownerAddr = deployParams.development.ownerAddr;
  const walletAddr = deployParams.development.walletAddr;

  // do not use account[0] since that is the default one in truffle
  const participantAcc = getTestrpcParticipantAcc(accounts);
  const kpAcc = getTestrpcKpAcc(accounts);
  const ppAcc = getTestrpcPpAcc(accounts);
  const participantDepositAmount = '50000';
  const sessionCost = 500;
  // contract instance
  let inst;

  describe('Commit method works correctly', function () {
    before(async function () {
      inst = await Quantum.deployed();
    });
    // total income for fees that the platform is getting
    let totalPlatformFee = web3.utils.toBN('0');
    let participantTxFees = web3.utils.toBN('0');
    let initialParticipantBalance;
    const defaultAccsPrivateKeys = defaultAccounts();
    
    it('makes a deposit', async function () {
      initialParticipantBalance = await web3.eth.getBalance(participantAcc);
      const depositResult = await contractCallMethod(inst, 'deposit', {
        from: participantAcc,
        value: participantDepositAmount,
        gasPrice: bidGasPrice,
      });
      assert.equal(depositResult.receipt.status, 1, 'Status of tx is not 1');

      participantTxFees = participantTxFees.add(
        web3.utils.toBN(depositResult.receipt.cumulativeGasUsed)
          .mul(web3.utils.toBN(bidGasPrice))
      );

      /*
      participantTxFees = participantTxFees.plus(
        new BigNumber(depositResult.receipt.cumulativeGasUsed)
          .multipliedBy(bidGasPrice)
      );
      */
      assert.notEqual(
        getEventOfType(depositResult.logs, 'Deposit'),
        null,
        'Deposit event was fired'
      );

      const participantDeposit = await inst.deposits(participantAcc);
      assert.equal(
        participantDepositAmount,
        participantDeposit.toString(),
        'participant has correct amount of wei in deposit account.'
      );

      const currentParticipantBalance = await web3.eth.getBalance(participantAcc);
      
      assert.equal(
        web3.utils.toBN(currentParticipantBalance).toString(),
        web3.utils.toBN(initialParticipantBalance)
          .sub(web3.utils.toBN(participantDepositAmount))
          .sub(web3.utils.toBN(participantTxFees))
          .toString()
      );
    });
 
    it('commit with wrong contract address should raise revert', async function () {
      const sessionId = '11111';
      let sig, r, s, v;

      sig = generateSignature(defaultAccsPrivateKeys.participantAcc,
        ['int', 'address', 'address', 'int', 'address'], [
          sessionId,
          participantAcc,
          kpAcc,
          sessionCost,
          inst.address,
        ]);
      r = concatSigRS(sig.r);
      s = concatSigRS(sig.s);
      v = new BN(concatSigV(sig.v), 16);

      let sigPlatform, rPlatform, sPlatform, vPlatform;

      sigPlatform = generateSignature(defaultAccsPrivateKeys.signerAddr,
        ['int', 'address', 'address', 'int', 'address'], [
          sessionId,
          participantAcc,
          kpAcc,
          sessionCost,
          inst.address,
        ]);
      rPlatform = concatSigRS(sigPlatform.r);
      sPlatform = concatSigRS(sigPlatform.s);
      vPlatform = new BN(concatSigV(sigPlatform.v), 16);

      await expectRevertAsync(inst.commit(
        participantAcc,
        kpAcc,
        sessionCost,
        sessionId,
        accounts[2],
        [v.toString(), vPlatform.toString()],
        [r, rPlatform],
        [s, sPlatform],
        { gas: bidGasPrice, from: ppAcc }
      ));
    });
  
    it('commit with wrong signature should raise revert', async function () {
      const sessionId = '11111';
      const signerAddress = [defaultAccsPrivateKeys.participantAcc, defaultAccsPrivateKeys.signerAddr];
      let sig, r, s, v;

      for (let i = 0; i <= 1; i++) {
        sig = generateSignature(signerAddress[i],
          ['int', 'address', 'address', 'int', 'address'], [
            sessionId,
            participantAcc,
            kpAcc,
            sessionCost,
            inst.address,
          ]);
        r = concatSigRS(sig.r);
        s = concatSigRS(sig.s);
        v = new BN(concatSigV(sig.v), 16);

        let sigPlatform, rPlatform, sPlatform, vPlatform;

        sigPlatform = generateSignature(signerAddress[i],
          ['int', 'address', 'address', 'int', 'address'], [
            sessionId,
            participantAcc,
            kpAcc,
            sessionCost,
            inst.address,
          ]);
        rPlatform = concatSigRS(sigPlatform.r);
        sPlatform = concatSigRS(sigPlatform.s);
        vPlatform = new BN(concatSigV(sigPlatform.v), 16);

        await expectRevertAsync(inst.commit(
          participantAcc,
          kpAcc,
          sessionCost,
          sessionId,
          inst.address,
          [v.toString(), vPlatform.toString()],
          [r, rPlatform],
          [s, sPlatform],
          { gas: bidGasPrice, from: ppAcc }
        ));
      }
    });
  
    it('commit', async function () {
      const wallet = await inst.wallet();
      const participantAccInitialDeposit = await inst.deposits(participantAcc);
      const platformRate = await inst.platformRate();
      const sessionId = '11111' + platformRate.toString();

      let sig, r, s, v;

      sig = generateSignature(defaultAccsPrivateKeys.participantAcc,
        ['int', 'address', 'address', 'int', 'address'], [
          sessionId,
          participantAcc,
          kpAcc,
          sessionCost,
          inst.address,
        ]);
      r = concatSigRS(sig.r);
      s = concatSigRS(sig.s);
      v = new BN(concatSigV(sig.v), 16);

      let sigPlatform, rPlatform, sPlatform, vPlatform;

      sigPlatform = generateSignature(defaultAccsPrivateKeys.signerAddr,
        ['int', 'address', 'address', 'int', 'address'], [
          sessionId,
          participantAcc,
          kpAcc,
          sessionCost,
          inst.address,
        ]);
      rPlatform = concatSigRS(sigPlatform.r);
      sPlatform = concatSigRS(sigPlatform.s);
      vPlatform = new BN(concatSigV(sigPlatform.v), 16);

      const participantAccDepositOriginal = await inst.deposits(participantAcc);
      const contractPlatformFeeOriginal = await inst.platformFee(wallet);
      const kpAccBalanceOriginal = await web3.eth.getBalance(kpAcc);

      console.log('-- Before commit --');
      console.log('[');
      console.log(`     platform fee rate: ${platformRate.toString()}%`);
      console.log(`     session cost: ${sessionCost}`);
      console.log(`     platform : ${contractPlatformFeeOriginal.toString()}`);
      console.log(`     kp deposit : ${kpAccBalanceOriginal.toString()}`);
      console.log(`     participant deposit: ${participantAccDepositOriginal.toString()}`);
      console.log(']');

      const commitResult = await inst.commit(
        participantAcc,
        kpAcc,
        sessionCost,
        sessionId,
        inst.address,
        [v.toString(), vPlatform.toString()],
        [r, rPlatform],
        [s, sPlatform],
        { gas: bidGasPrice, from: ppAcc }
      );
      
      assert.notEqual(
        getEventOfType(commitResult.logs, 'Commit'),
        null,
        'Commit event was fired'
      );
      assert.notEqual(
        getEventOfType(commitResult.logs, 'Payment'),
        null,
        'Payment event was fired'
      );

      const participantAccDeposit = await inst.deposits(participantAcc);
      const contractPlatformFee = await inst.platformFee(wallet);
      const kpAccBalance = await web3.eth.getBalance(kpAcc);
      
      console.log('');
      console.log('-- After commit --');
      console.log('[');
      console.log(`     platform fee rate: ${platformRate.toString()}%`);
      console.log(`     session cost: ${sessionCost}`);
      console.log(`     platform : ${contractPlatformFee.toString()}`);
      console.log(`     kp deposit : ${kpAccBalance.toString()}`);
      console.log(`     participant deposit: ${participantAccDeposit.toString()}`);
      console.log(']');

      const sessionPlatformFee = web3.utils.toBN(sessionCost).mul(platformRate).divRound(web3.utils.toBN('100'));
      totalPlatformFee = totalPlatformFee.add(sessionPlatformFee);
      
      assert.equal(
        contractPlatformFee.toString(),
        sessionPlatformFee.toString(),
        'correct platform fee stored in the contract'
      );
      
      assert.equal(
        participantAccDeposit.toString(),
        participantAccInitialDeposit
          .sub(web3.utils.toBN(sessionCost))
          .toString(),
        'participant has correct deposit left'
      );

      assert.equal(
        kpAccBalance.toString(),
        web3.utils.toBN(kpAccBalanceOriginal)
          .add(web3.utils.toBN(sessionCost))
          .sub(sessionPlatformFee)
          .toString()
      );
    });

    it('platform can pay itself the correct amount', async function () {
      const walletBalanceInitial = await web3.eth.getBalance(walletAddr);
      
      const payPlatformResult = await inst.payPlatform({
        from: ownerAddr,
        gasPrice: bidGasPrice,
      });

      assert.notEqual(
        getEventOfType(payPlatformResult.logs, 'Payment'),
        null,
        'Payment event was fired'
      );

      const payPlatformLogs = payPlatformResult.logs[0];
      assert.equal(
        payPlatformLogs.type,
        'mined'
      );
                  
      assert.equal(
        payPlatformLogs.args._to,
        web3.utils.toChecksumAddress(walletAddr)
      );

      assert.equal(
        payPlatformLogs.args._amount.toString(),
        totalPlatformFee.toString(),
      );

      await mineSingleBlockAsync();
      
      const walletBalance = await web3.eth.getBalance(walletAddr);
      assert.equal(
        web3.utils.toBN(walletBalance)
          .sub(web3.utils.toBN(walletBalanceInitial))
          .toString(),
        totalPlatformFee.toString()
      );
    });
   
    it('commit with greater value than user deposit should raise revert', async function () {
      let sig, r, s, v;
      const sessionId = '11111';
        
      await contractCallMethod(inst, 'deposit', {
        from: participantAcc,
        value: participantDepositAmount,
        gasPrice: bidGasPrice,
      });
      const participantAccDeposit = await inst.deposits(participantAcc);
      const increment = new BigNumber('1');

      sig = generateSignature(defaultAccsPrivateKeys.participantAcc,
        ['int', 'address', 'address', 'int', 'address'], [
          sessionId,
          participantAcc,
          kpAcc,
          sessionCost,
          inst.address,
        ]);
      r = concatSigRS(sig.r);
      s = concatSigRS(sig.s);
      v = new BN(concatSigV(sig.v), 16);

      let sigPlatform, rPlatform, sPlatform, vPlatform;

      sigPlatform = generateSignature(defaultAccsPrivateKeys.signerAddr,
        ['int', 'address', 'address', 'int', 'address'], [
          sessionId,
          participantAcc,
          kpAcc,
          sessionCost,
          inst.address,
        ]);
      rPlatform = concatSigRS(sigPlatform.r);
      sPlatform = concatSigRS(sigPlatform.s);
      vPlatform = new BN(concatSigV(sigPlatform.v), 16);

      await expectRevertAsync(inst.commit(
        participantAcc,
        kpAcc,
        web3.utils.toBN(participantAccDeposit)
          .add(web3.utils.toBN(increment)),
        sessionId,
        inst.address,
        [v.toString(), vPlatform.toString()],
        [r, rPlatform],
        [s, sPlatform],
        { gas: bidGasPrice, from: ppAcc }
      ));
    });
       
    // commit with value less or equal with participant payment session reverts at modifier
    it('commit with invalid value should raise revert (isValid modifier triggered)', async function () {
      let sig, r, s, v;
      const sessionId = '11111';
      
      await contractCallMethod(inst, 'deposit', {
        from: participantAcc,
        value: participantDepositAmount,
        gasPrice: bidGasPrice,
      });

      const particPayment = await inst.getParticipantPayment(participantAcc, sessionId);

      sig = generateSignature(defaultAccsPrivateKeys.participantAcc,
        ['int', 'address', 'address', 'int', 'address'], [
          sessionId,
          participantAcc,
          kpAcc,
          sessionCost,
          inst.address,
        ]);
      r = concatSigRS(sig.r);
      s = concatSigRS(sig.s);
      v = new BN(concatSigV(sig.v), 16);

      let sigPlatform, rPlatform, sPlatform, vPlatform;

      sigPlatform = generateSignature(defaultAccsPrivateKeys.signerAddr,
        ['int', 'address', 'address', 'int', 'address'], [
          sessionId,
          participantAcc,
          kpAcc,
          sessionCost,
          inst.address,
        ]);
      rPlatform = concatSigRS(sigPlatform.r);
      sPlatform = concatSigRS(sigPlatform.s);
      vPlatform = new BN(concatSigV(sigPlatform.v), 16);
      
      await expectRevertAsync(inst.commit(
        participantAcc,
        kpAcc,
        particPayment.toString(),
        sessionId,
        inst.address,
        [v.toString(), vPlatform.toString()],
        [r, rPlatform],
        [s, sPlatform],
        { gas: bidGasPrice, from: ppAcc }
      ));
    });
  });
});
