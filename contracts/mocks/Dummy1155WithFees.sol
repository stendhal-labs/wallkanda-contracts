// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC1155/ERC1155.sol';
import '../Tokens/ERC2981/ERC2981Royalties.sol';

contract Dummy1155WithFees is ERC1155, ERC2981Royalties {
    constructor(
        address owner,
        uint256 id,
        uint256 amount,
        address royaltiesRecipient,
        uint256 royaltiesValue
    ) ERC1155('ipfs://ipfs/') {
        _mint(owner, id, amount, '');
        _setTokenRoyalty(id, royaltiesRecipient, royaltiesValue);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC1155, ERC2981Royalties)
        returns (bool)
    {
        return ERC2981Royalties.supportsInterface(interfaceId) || ERC1155.supportsInterface(interfaceId);
    }
}
