const util = require('ethereumjs-util');
const abi = require('ethereumjs-abi');
const SolidityEvent = require('web3/lib/web3/event.js');
const Quantum = artifacts.require('./Quantum.sol');

module.exports = () => {
  const bidGasPrice = 400000;
  // higher values (eg. 120) cause testrpc to crash with
  // "Error: Number can only safely store up to 53 bits"
  const withdrawTimeLimit = 5;
  const withdrawTimeLimitThreshold = 1;

  async function createAccountsAsync (privateKeys) {
    const accounts = [];
    for (let key of privateKeys) {
      console.log(`Creating account with private key ${key}...`);
      const acc = await web3.eth.accounts.privateKeyToAccount(key);
      accounts.push(acc);
    }

    return accounts;
  }

  async function expectRevertAsync (promise, assertMsg) {
    assertMsg = assertMsg || '';
    try {
      await promise;
    } catch (error) {
      const revert = error.message.search('revert') >= 1;
      assert(
        revert,
        'Expected revert, got \'' + error + '\' instead: ' + assertMsg,
      );
      return;
    }
    assert.fail(`Expected revert not received: ${assertMsg}`);
  }

  // Workaround for a compatibility issue between web3@1.0.0-beta.29 and truffle-contract@3.0.3
  // https://github.com/trufflesuite/truffle-contract/issues/57#issuecomment-331300494
  function ensureCompat () {
    if (typeof web3.currentProvider.sendAsync !== 'function') {
      web3.currentProvider.sendAsync = function () {
        return web3.currentProvider.send.apply(
          web3.currentProvider, arguments
        );
      };
    }
  }

  function mineSingleBlockAsync () {
    ensureCompat();
    return new Promise(function (resolve, reject) {
      web3.currentProvider.sendAsync({
        jsonrpc: '2.0',
        method: 'evm_mine',
        id: new Date().getTime(),
      }, function (err) {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });
  }

  function increaseTimeAsync (duration) {
    ensureCompat();
    const id = Date.now();

    return new Promise((resolve, reject) => {
      web3.currentProvider.sendAsync({
        jsonrpc: '2.0',
        method: 'evm_increaseTime',
        params: [duration],
        id: id,
      }, err1 => {
        if (err1) return reject(err1);

        web3.currentProvider.sendAsync({
          jsonrpc: '2.0',
          method: 'evm_mine',
          id: id + 1,
        }, (err2, res) => {
          return err2 ? reject(err2) : resolve(res);
        });
      });
    });
  }

  /**
   * Returns a list of private keys for default accounts
   */
  function defaultAccounts () {
    return {
      'participantAcc': '0x86542fb58ff2c152006f6a32ce58317aba7b9c590f6c5cae38bfb0c50ec4a32d',
      'kpAcc': '0xf2b51bae6068e05631a854fb22dfb4c03d6d6c4d5a9b194a102dc9369b84b7e5',
      'ppAcc': '0xa28abfbfc9aa9828b0fb5a59f551f8b2727ada774a6b48c6a936ec6679af9c45',
      'newPlatformAcc': '0x0861bde60c39e5235fe3441d851c8502851247c092e4151602eb913ff3061b84',
      'newWalletAcc': '0x5a54ca462460f7bbcb6cec7a5b35f955b8994451f33de820febc41dde17a4704',
      'signerAddr': '0x0861bde60c39e5235fe3441d851c8502851247c092e4151602eb913ff3061b84',
    };
  }

  function validateTestrpcAccountsSetup (testrpcAccounts) {
    const accs = defaultAccounts();
    const participant = getTestrpcParticipantAcc(testrpcAccounts);
    const participantFromPriv = web3.utils.toChecksumAddress(
      '0x' + util.privateToAddress(accs.participantAcc).toString('hex')
    );
    const kp = getTestrpcKpAcc(testrpcAccounts);
    const kpFromPriv = web3.utils.toChecksumAddress(
      '0x' + util.privateToAddress(accs.kpAcc).toString('hex')
    );
    const pp = getTestrpcPpAcc(testrpcAccounts);
    const ppFromPriv = web3.utils.toChecksumAddress(
      '0x' + util.privateToAddress(accs.ppAcc).toString('hex')
    );
    const newPlatform = getTestrpcNewPlatformAcc(testrpcAccounts);
    const newPlatformFromPriv = web3.utils.toChecksumAddress(
      '0x' + util.privateToAddress(accs.newPlatformAcc).toString('hex')
    );

    const newWallet = getTestrpcNewWalletAcc(testrpcAccounts);
    const newWalletFromPriv = web3.utils.toChecksumAddress(
      '0x' + util.privateToAddress(accs.newWalletAcc).toString('hex')
    );

    if (participant !== participantFromPriv) {
      throw new Error(`Key provided in testrpc for participant is incorrect: ${participant} vs ${participantFromPriv}`);
    }

    if (kp !== kpFromPriv) {
      throw new Error(`Key provided in testrpc for kp is incorrect: ${kp} vs ${kpFromPriv}`);
    }

    if (pp !== ppFromPriv) {
      throw new Error(`Key provided in testrpc for pp is incorrect: ${pp} vs ${ppFromPriv}`);
    }

    if (newPlatform !== newPlatformFromPriv) {
      throw new Error(`Key provided in testrpc for newPlatform is incorrect: ${newPlatform} vs ${newPlatformFromPriv}`);
    }

    if (newWallet !== newWalletFromPriv) {
      throw new Error(`Key provided in testrpc for newWallet is incorrect: ${newWallet} vs ${newWalletFromPriv}`);
    }
    /*
    if (signer !== signerFromPriv) {
      throw new Error(`Key provided in testrpc for signer is incorrect: ${signer} vs ${signerFromPriv}`);
    }
    */
  }

  function getTestrpcParticipantAcc (testrpcAccounts) {
    return testrpcAccounts[2];
  }

  function getTestrpcKpAcc (testrpcAccounts) {
    return testrpcAccounts[3];
  }

  function getTestrpcPpAcc (testrpcAccounts) {
    return testrpcAccounts[4];
  }

  function getTestrpcNewPlatformAcc (testrpcAccounts) {
    return testrpcAccounts[5];
  }

  function getTestrpcNewWalletAcc (testrpcAccounts) {
    return testrpcAccounts[6];
  }

  function getTestrpcSignerAcc (testrpcAccounts) {
    return testrpcAccounts[7];
  }

  function getEventOfType (logs, evType) {
    let evLog = null;
    for (var i = 0; i < logs.length; i++) {
      var log = logs[i];

      if (log.event === evType) {
        evLog = log;
        break;
      }
    }
    return evLog;
  }

  function concatSig (signature) {
    const r = util.stripHexPrefix(concatSigRS(signature.r));
    const s = util.stripHexPrefix(concatSigRS(signature.s));
    const v = concatSigV(signature.v);
    return util.addHexPrefix(r.concat(s, v).toString('hex'));
  };

  function concatSigRS (rs) {
    return '0x' + util.setLengthLeft(
      util.toUnsigned(
        util.fromSigned(rs)
      ),
      32
    ).toString('hex');
  }

  function concatSigV (v) {
    return util.stripHexPrefix(
      util.intToHex(util.bufferToInt(v))
    );
  }

  /**
   *
   * @param {*} from
   *   Private key to sign the data with
   * @param {*} dataTypesArr
   *   A list of data types. Eg ['int', 'address', 'address', 'int']
   * @param {*} valuesArr
   *   A list of values that matches the list of data types.
   */
  function generateSignature (from, dataTypesArr, valuesArr) {
    const transactionHash = abi
      .soliditySHA3(dataTypesArr, valuesArr)
      .toString('hex');
    const sgn = util.ecsign(
      Buffer.from(util.stripHexPrefix(transactionHash), 'hex'),
      Buffer.from(util.stripHexPrefix(from), 'hex')
    );
    return sgn;
  }

  function decodeLogs (logs, contract, address) {
    return logs.map(log => {
      const event = new SolidityEvent(null, contract.events[log.topics[0]], address);
      return event.decode(log);
    });
  }

  /**
   * Helper function to call methods on the contract
   * Will normalise the return value to always return a receipt object
   * since in different versions of Truffle calling a contract method might
   * return a transaction string or an object.
   *
   * @param {*} contractInstance
   * @param {*} method
   * @param {*} params
   */
  async function contractCallMethod (contractInstance, method, ...params) {
    let result = await contractInstance[method].apply(null, params);
    if (typeof result === 'string') {
      result = await web3.eth.getTransactionReceipt(result);
    }
    if (typeof result.logs === 'undefined') {
      result.logs = decodeLogs(result.receipt.logs, Quantum, contractInstance.address);
    }

    return result;
  }

  return {
    bidGasPrice,
    contractCallMethod,
    createAccountsAsync,
    decodeLogs,
    defaultAccounts,
    mineSingleBlockAsync,
    increaseTimeAsync,
    generateSignature,
    expectRevertAsync,
    getEventOfType,
    validateTestrpcAccountsSetup,
    getTestrpcParticipantAcc,
    getTestrpcKpAcc,
    getTestrpcPpAcc,
    getTestrpcNewPlatformAcc,
    getTestrpcNewWalletAcc,
    getTestrpcSignerAcc,
    concatSig,
    concatSigRS,
    concatSigV,
    withdrawTimeLimit,
    withdrawTimeLimitThreshold,
  };
};
