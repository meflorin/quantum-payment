const {
  expectRevertAsync,
  getEventOfType,
  // increaseTimeAsync,
  contractCallMethod,
  bidGasPrice,
  validateTestrpcAccountsSetup,
  getTestrpcParticipantAcc,
  getTestrpcPpAcc,
  // getTestrpcKpAcc
} = require('./utils')();

// const deployParams = require('../config/deploy_params');
const Quantum = artifacts.require('./Quantum.sol');
// const BN = require('bn.js');
const BigNumber = require('bignumber.js');
// const sessionId = '176359026127';
// const sessionCost = '164166287821387';

contract('Quantum', function (accounts) {
  // const ownerAddr = deployParams.development.ownerAddr;

  const participantAcc = getTestrpcParticipantAcc(accounts);
  // const kpAcc = getTestrpcKpAcc(accounts);
  const ppAcc = getTestrpcPpAcc(accounts);

  const participantDepositAmount = 5000;
  // contract instance
  let inst;
  // total cost of all transactions made on the blockchain
  // by the participant account
  let participantTxFees = new BigNumber(0);
  let participantBalance = 0;

  describe('basic contract functionality', () => {
    before(async function () {
      inst = await Quantum.deployed();
    });

    it('ensure test setup is correct', async function () {
      validateTestrpcAccountsSetup(accounts);
    });

    describe('withdraw time limit functionality', async function () {
      it('initWithdraw raises revert for account with no funds', async function () {
        await expectRevertAsync(inst.initWithdraw({
          from: ppAcc,
          gasPrice: bidGasPrice,
        }));
      });

      it('withdraw flag is set to 0 by default', async function () {
        const withdrawMap = await inst.withdrawMap(participantAcc);
        assert.equal(withdrawMap[0].toString(), '0');
      });

      it('initWithdraw works for account with funds', async function () {
        await inst.deposit({
          from: participantAcc,
          value: participantDepositAmount,
          gasPrice: bidGasPrice,
        });
        const initWithdrawResult = await contractCallMethod(inst, 'initWithdraw', {
          from: participantAcc,
          gasPrice: bidGasPrice,
        });
        assert.equal(initWithdrawResult.receipt.status, 1);
        const withdrawMap = await inst.withdrawMap(participantAcc);
        assert.equal(withdrawMap[0].toString(), '1');
      });

      it('withdraw call before timelimit does not do anything', async function () {
        const initialDeposit = await inst.deposits(participantAcc);
        const result = await contractCallMethod(inst, 'withdraw', participantAcc, {
          from: participantAcc,
          gasPrice: bidGasPrice,
        });
        assert.equal(result.receipt.status, 1, 'Status of tx is not 1');
        assert.equal(
          result.logs.length,
          0,
          'withdraw call before timelimit should not have emitted any events'
        );
        const newDeposit = await inst.deposits(participantAcc);
        assert.notEqual(newDeposit.toString(), '0');
        assert.equal(newDeposit.toString(), initialDeposit.toString());
      });
    });

    /*
    it('generated signature should match the pre-generated one', async function () {
      const sig =
      '0x5f4643ec19cd6838ee1453a363dc678a8466fa1792ee0b960282340bf007d2314dab4801cf15503e
      b653f9cc544dbd815a7bc5ee617c951094ccdb7f7b8451561c';
      // eslint-disable-line
      // signature components
      const r = sig.substr(0, 66);
      const s = '0x' + sig.substr(66, 64);
      const v = new BN(sig.substr(130, 2), 16);
      const defaultAccsPrivateKeys = defaultAccounts();
      const sgn = generateSignature(defaultAccsPrivateKeys.participantAcc,
        ['int', 'address', 'address', 'int'], [
          sessionId,
          participantAcc,
          kpAcc,
          sessionCost,
        ]);

      assert.equal(concatSigRS(sgn.r), r, 'signature.r matches');
      assert.equal(concatSigRS(sgn.s), s, 'signature.s matches');
      assert.equal(concatSigV(sgn.v), v.toString(16), 'signature.v matches');
      assert.equal(concatSig(sgn), sig, 'signatures match');
    });
    */

    it('deposit should work', async function () {
      participantBalance = await web3.eth.getBalance(participantAcc);
      const participantInitialBalance = participantBalance;

      const depositResult = await contractCallMethod(inst, 'deposit', {
        from: participantAcc,
        value: participantDepositAmount,
        gasPrice: bidGasPrice,
      });

      assert.notEqual(
        getEventOfType(depositResult.logs, 'Deposit'),
        null,
        'Deposit event was fired'
      );

      participantTxFees = participantTxFees.plus(new BigNumber(depositResult.receipt.cumulativeGasUsed)
        .multipliedBy(bidGasPrice));

      participantBalance = await web3.eth.getBalance(participantAcc);
      // sanity check
      assert.equal(
        new BigNumber(participantBalance).toString(),
        new BigNumber(participantInitialBalance)
          .minus(participantDepositAmount)
          .minus(participantTxFees)
          .toString()
      );

      const depositsResult = await inst.deposits(participantAcc);
      assert.equal(
        participantDepositAmount.toString(),
        depositsResult.toString(),
        'participantAcc does not have the expected eposit value.'
      );
     
      participantBalance = await web3.eth.getBalance(participantAcc);

      // sanity check to ensure we calculate fees correctly
      assert.equal(
        web3.utils.toBN(participantBalance).toString(),
        web3.utils.toBN(participantInitialBalance)
          .sub(web3.utils.toBN(participantTxFees))
          .sub(web3.utils.toBN(participantDepositAmount))
          .toString(),
        'participant wallet balance is correct after deposit'
      );
    });

    it('platform actions time interval shoulb be greater than 0', async function () {
      const platformActionTimeLimit = await inst.platformActionTimeLimit();
      assert(platformActionTimeLimit.toString() > 0, 'platform actions time interval cannot be zero or less');
    });

    it('platform rate change request flag is set to 0 by default', async function () {
      const platformChangeRequestFlag = await inst.platformRateChangeTime();
      assert.equal(platformChangeRequestFlag.toString(), 0, 'platform rate change request flag must be 0 by default');
    });

    it('signer address change request flag is set to 0 by default', async function () {
      const signerChangeRequestFlag = await inst.platformRateChangeTime();
      assert.equal(signerChangeRequestFlag.toString(), 0, 'signer address change request flag must be 0 by default');
    });
  });
});
