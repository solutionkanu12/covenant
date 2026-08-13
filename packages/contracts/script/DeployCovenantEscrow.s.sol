// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IFdcVerification} from "flare-periphery/src/coston2/IFdcVerification.sol";
import {CovenantEscrow} from "../src/CovenantEscrow.sol";

contract DeployCovenantEscrow is Script {
    uint256 private constant COSTON2_CHAIN_ID = 114;

    function run() external returns (CovenantEscrow escrow) {
        require(block.chainid == COSTON2_CHAIN_ID, "Coston2 only");

        address deployer = vm.envAddress("COVENANT_DEPLOYER");
        IERC20 collateralToken = IERC20(vm.envAddress("COVENANT_COLLATERAL_TOKEN"));
        IFdcVerification fdcVerification = IFdcVerification(vm.envAddress("COVENANT_FDC_VERIFICATION"));

        vm.startBroadcast(deployer);
        escrow = new CovenantEscrow(collateralToken, fdcVerification);
        vm.stopBroadcast();
    }
}
