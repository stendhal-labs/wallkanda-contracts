require('@nomiclabs/hardhat-ethers');
require('@nomiclabs/hardhat-waffle');
require('@openzeppelin/hardhat-upgrades');
require('hardhat-deploy');
require('hardhat-deploy-ethers');
require('hardhat-tracer');
require('@nomiclabs/hardhat-etherscan');
require('solidity-coverage');
const dotenv = require('dotenv');

function mergeConfigs(path) {
    const { parsed } = dotenv.config({
        path,
    });

    Object.keys(parsed).forEach((key) => {
        if ('' !== parsed[key]) {
            process.env[key] = parsed[key];
        }
    });
}

// load .env
dotenv.config();
// override .env with specific .env.[network]
var argv = require('minimist')(process.argv.slice(2));
if (argv.network && ['rinkeby', 'mainnet'].indexOf(argv.network) !== -1) {
    mergeConfigs(`.env.${argv.network}`);
}

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
    solidity: {
        version: '0.8.0',
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },
    networks: {
        rinkeby: {
            gasPrice: 90000000000,
            url: process.env.PROVIDER,
            accounts: [
                process.env.DEPLOYER_PKEY,
                process.env.EXCHANGE_SIGNER_PKEY,
            ],
        },
        mainnet: {
            gasPrice: 50000000000,
            url: process.env.PROVIDER,
            accounts: [
                process.env.DEPLOYER_PKEY,
                process.env.EXCHANGE_SIGNER_PKEY,
            ],
        },
    },
    namedAccounts: {
        deployer: {
            default: 0, // here this will by default take the first account as deployer
        },
        exchangeSigner: {
            default: 1,
        },
    },
    // defines where to find already deployed contracts since we are reusing some contracts from BeyondNFT
    // (TransferProxy and SampleSale)
    // external: {
    //     contracts: [
    //         {
    //             artifacts: './build/contracts',
    //         },
    //     ],
    //     deployments: {
    //         mainnet: ['./build/contracts'],
    //         rinkeby: ['./build/contracts'],
    //     },
    // },

    etherscan: {
        // Your API key for Etherscan
        // Obtain one at https://etherscan.io/
        apiKey: process.env.ETHERSCAN_API_KEY,
    },
};
