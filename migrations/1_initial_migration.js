const Migrations = artifacts.require('./Migrations.sol');
const deployParams = require('../config/deploy_params');

module.exports = function (deployer, network, accounts) {
  console.log('[Network: ]', network);
  console.log('[Accounts:]', accounts);

  if (typeof deployParams[network] === 'undefined') {
    console.error(`Unknown network ${network}`);
    process.exit(1);
  }

  const ownerAddr = deployParams[network].ownerAddr;
  const walletAddr = deployParams[network].walletAddr;
  const signerAddr = deployParams[network].signerAddr;
  
  console.log(
    '-----------------------------------------------------------------------'
  );
  console.log('   Will deploy using these values:');
  console.log(
    '-----------------------------------------------------------------------'
  );
  console.log('           OWNER ADDRESS:', ownerAddr);
  console.log('           WALLET ADDRESS:', walletAddr);
  console.log('           SIGNER ADDRESS:', signerAddr);
  console.log(
    '-----------------------------------------------------------------------'
  );
  const deployOpts = {
    from: ownerAddr,
  };
  if (typeof deployParams[network].gas !== 'undefined') {
    deployOpts.gas = deployParams[network].gas;
  }

  deployer.deploy(Migrations, deployOpts);
};
