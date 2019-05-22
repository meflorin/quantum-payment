/**
 * @file
 *
 * Test wallet address.
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
  let walletAddr = deployParams.development.walletAddr;
  const participantAcc = getTestrpcParticipantAcc(accounts);
  const newWalletAddr = accounts[2];
  let inst;
    
  describe('wallet address basic functionality', () => {
    before(async function () {
      inst = await Quantum.deployed();
    });

    it('non-platform accounts should not be allowed to initiate change wallet address', async function () {
      await expectRevertAsync(inst.initWalletChange(newWalletAddr, {
        from: participantAcc,
        gasPrice: bidGasPrice,
      }));
    });
    
    it('it should not be possible to initiate change wallet address with the current one', async function () {
      await expectRevertAsync(inst.initWalletChange(walletAddr, {
        from: ownerAddr,
        gasPrice: bidGasPrice,
      }));
    });

    it('non-platform accounts should not be allowed to commit change wallet address', async function () {
      await expectRevertAsync(inst.commitWalletChange({
        from: participantAcc,
        gasPrice: bidGasPrice,
      }));
    });

    it('new wallet address set to zero should not be allowed to commit change signer address', async function () {
      await expectRevertAsync(inst.commitWalletChange({
        from: ownerAddr,
        gasPrice: bidGasPrice,
      }));
    });
  });
});
