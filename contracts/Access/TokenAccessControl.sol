// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/access/AccessControl.sol';

contract TokenAccessControl is AccessControl {
    bytes32 public constant TRUSTED_PROXY = keccak256('TRUSTED_PROXY');

    modifier onlyAdmin() {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, _msgSender()),
            'MinterRole: E-ONLY-ADMIN'
        );
        _;
    }
}
