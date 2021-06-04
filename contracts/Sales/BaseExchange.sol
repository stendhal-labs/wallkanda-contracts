// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';

import '../Proxys/Transfer/ITransferProxy.sol';
import '../Security/MessageSigning.sol';

contract BaseExchange is OwnableUpgradeable, MessageSigning {
    enum TokenType {ERC1155, ERC721}

    uint256 public sellerServiceFee;
    uint256 public buyerServiceFee;

    address payable public beneficiary;
    ITransferProxy public transferProxy;

    function __BaseExchange_init(
        address payable _beneficiary,
        address _transferProxy,
        uint256 _buyerServiceFee,
        uint256 _sellerServiceFee
    ) internal initializer {
        __OwnableOperatorControl_init();

        setBeneficiary(_beneficiary);
        setTransferProxy(_transferProxy);
        setBuyerServiceFee(_buyerServiceFee);
        setSellerServiceFee(_sellerServiceFee);
    }

    function setBuyerServiceFee(uint256 _buyerServiceFee) public onlyOwner {
        buyerServiceFee = _buyerServiceFee;
    }

    function setSellerServiceFee(uint256 _sellerServiceFee) public onlyOwner {
        sellerServiceFee = _sellerServiceFee;
    }

    function setTransferProxy(address _transferProxy) public onlyOwner {
        require(_transferProxy != address(0));
        transferProxy = ITransferProxy(_transferProxy);
    }

    function setBeneficiary(address payable _beneficiary) public onlyOwner {
        require(_beneficiary != address(0));
        beneficiary = _beneficiary;
    }
}
