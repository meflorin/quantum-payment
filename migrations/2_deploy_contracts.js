const Quantum = artifacts.require('./Quantum.sol');
const deployParams = require('../config/deploy_params');

module.exports = function (deployer, network, accounts) {
  const ownerAddr = deployParams[network].ownerAddr;
  const walletAddr = deployParams[network].walletAddr;
  const signerAddr = deployParams[network].signerAddr;

  const deployOpts = {
    from: ownerAddr,
  };
  
  if (typeof deployParams[network].gas !== 'undefined') {
    deployOpts.gas = deployParams[network].gas;
  }
  deployer.deploy(Quantum, ownerAddr, walletAddr, signerAddr, deployOpts);
};
