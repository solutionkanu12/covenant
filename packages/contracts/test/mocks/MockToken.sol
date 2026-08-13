// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockToken is ERC20 {
    constructor() ERC20("FTestXRP", "FTestXRP") {}

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }
}

contract FeeOnTransferToken is ERC20 {
    bool public feeEnabled = true;

    constructor() ERC20("Fee FTestXRP", "feeFTestXRP") {}

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }

    function setFeeEnabled(bool enabled) external {
        feeEnabled = enabled;
    }

    function _update(address from, address to, uint256 value) internal override {
        if (feeEnabled && from != address(0) && to != address(0)) {
            uint256 fee = value / 10;
            super._update(from, address(0), fee);
            super._update(from, to, value - fee);
        } else {
            super._update(from, to, value);
        }
    }
}

contract DishonestToken is ERC20 {
    bool public suppressTransfers;

    constructor() ERC20("Dishonest FTestXRP", "badFTestXRP") {}

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }

    function setSuppressTransfers(bool suppress) external {
        suppressTransfers = suppress;
    }

    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        if (suppressTransfers) return true;
        return super.transferFrom(from, to, value);
    }

    function transfer(address to, uint256 value) public override returns (bool) {
        if (suppressTransfers) return true;
        return super.transfer(to, value);
    }
}

/// @dev Unsupported collateral used only to prove that a negative rebase fails closed.
contract NegativeRebaseToken is ERC20 {
    constructor() ERC20("Unsupported Rebasing Token", "REBASE") {}

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }

    function rebaseDown(address account, uint256 amount) external {
        _burn(account, amount);
    }
}
