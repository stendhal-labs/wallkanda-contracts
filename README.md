# Wallkanda contracts

> The web3 toolbox for street-artists.

This repository contains all the Solidity contracts for [Wallkanda](https://wallkanda.art), their tests and deployment files.

The existing contracts includes:

- a **NFT** ([ERC1155](https://eips.ethereum.org/EIPS/eip-1155)) contract to mint artworks
- a **Sale** contract to support buy/sell and auctions

## Overview

[Hardhat](https://hardhat.org/) and its wide range of plugins are our preferred development tool.

### Setup

#### Installation

`npm install`

Create a `.env` file from `.env.SAMPLE`

#### Test

`npm run test`

### Contract metadata

The contract metadata for NFT are made available for OpenSea in `contracts-metadata\mainnet.json`.

## Credits

- [BeyondNFT](https://beyondnft.io/) for existing/shared contracts already deployed on Mainnet.
- [OpenZeppelin contracts library](https://github.com/OpenZeppelin/openzeppelin-contracts)

## License

Wallkanda Contracts are released under the [MIT License](LICENSE).
