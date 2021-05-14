// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC721/ERC721.sol';

contract Dummy721 is ERC721 {
    constructor() ERC721('Test', 'TEST') {
        _mint(_msgSender(), 1);
        _mint(_msgSender(), 2);
        _mint(_msgSender(), 3);
    }

    /**
     * @dev Base URI for computing {tokenURI}. Empty by default, can be overriden
     * in child contracts.
     */
    function _baseURI() internal view override virtual returns (string memory) {
        return "ipfs://ipfs";
    }

    function mint(uint256 id) external {
        _mint(_msgSender(), id);
    }

    function burn(uint256 id) external {
        _burn(id);
    }
}
