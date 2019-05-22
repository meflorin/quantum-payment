/**
 * @file
 *
 * Test signer address.
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
  let signerAddr = deployParams.development.signerAddr;
  const participantAcc = getTestrpcParticipantAcc(accounts);
  let inst;
  const newSignerAddr = accounts[2];
    
  describe('signer address basic functionality', () => {
    before(async function () {
      inst = await Quantum.deployed();
    });

    it('non-platform accounts should not be allowed to initiate change signer address', async function () {
      await expectRevertAsync(inst.initChangeSigner(newSignerAddr, {
        from: participantAcc,
        gasPrice: bidGasPrice,
      }));
    });

    it('it should not be possible to initiate change signer address with the current one', async function () {
      await expectRevertAsync(inst.initChangeSigner(signerAddr, {
        from: ownerAddr,
        gasPrice: bidGasPrice,
      }));
    });

    it('non-platform accounts should not be allowed to commit change signer address', async function () {
      await expectRevertAsync(inst.commitChangeSigner({
        from: participantAcc,
        gasPrice: bidGasPrice,
      }));
    });

    it('new signer address set to zero should not allow to commit change signer address', async function () {
      await expectRevertAsync(inst.commitChangeSigner({
        from: ownerAddr,
        gasPrice: bidGasPrice,
      }));
    });
  });
});
