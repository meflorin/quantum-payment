const ownerAddrTest = '0x29c5927350a70e3df7d1d07affebe33a3cfe5e04';
const walletAddrTest = '0x5703741518b7f5c92a7cc7ce66a00b74f6b494e8';
const signerAddrTest = '0x7979F7BC8E79195b71540687417E6b2925C87aE1';

const ownerAddrInfura = '0xbd6391ab839b5b67f7114af095738dc42cb97d6d';
const walletAddrInfura = '0x656f5cdbca35c992c42b156b372e7d12fb7ccdc5';
const signerAddrInfura = '0xfdec09fd0b31c37a896e953ba1eeadd8e96d9183';

module.exports = {
  'development': {
    'ownerAddr': ownerAddrTest,
    'walletAddr': walletAddrTest,
    'signerAddr': signerAddrTest,
    'gas': 1000000000,
  },
  'test': {
    'ownerAddr': ownerAddrTest,
    'walletAddr': walletAddrTest,
    'signerAddr': signerAddrTest,
    'gas': 1000000000,
  },
  'rinkeby': {
    'ownerAddr': ownerAddrInfura,
    'walletAddr': walletAddrInfura,
    'gas': 4700000,
  },
  'kovan': {
    'ownerAddr': ownerAddrInfura,
    'walletAddr': walletAddrInfura,
    'signerAddr': signerAddrInfura,
    'gas': 4700000,
  },
  'coverage': {
    'ownerAddr': ownerAddrTest,
    'walletAddr': walletAddrTest,
    'signerAddr': signerAddrTest,
    'gas': 1000000000,
  },
  // "mainnet": {
  //     "wallet": wallet_mainnet_config,
  //     "auction": auction_mainnet_config,
  //     "token": token_mainnet_config
  // },
  // "infuranet": {
  //     "wallet": wallet_test_config,
  //     "auction": auction_test_config,
  //     "token": token_test_config
  // },
  // "ropsten": {
  //     "wallet": wallet_test_config,
  //     "auction": auction_test_config,
  //     "token": token_test_config
  // }
};
