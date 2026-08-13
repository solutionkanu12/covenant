// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {StdInvariant} from "forge-std/StdInvariant.sol";
import {Test} from "forge-std/Test.sol";
import {CovenantEscrow} from "../src/CovenantEscrow.sol";
import {IFdcVerification} from "flare-periphery/src/coston2/IFdcVerification.sol";
import {IPayment} from "flare-periphery/src/coston2/IPayment.sol";
import {
    IReferencedPaymentNonexistence
} from "flare-periphery/src/coston2/IReferencedPaymentNonexistence.sol";
import {MockFdcVerification} from "./mocks/MockFdcVerification.sol";
import {MockToken} from "./mocks/MockToken.sol";

contract EscrowHandler is Test {
    CovenantEscrow public immutable escrow;
    MockToken public immutable token;
    MockFdcVerification public immutable verifier;
    uint256 private nonce;
    address[] private actors;
    bool public terminalStateViolation;

    constructor(CovenantEscrow escrow_, MockToken token_, MockFdcVerification verifier_) {
        escrow = escrow_;
        token = token_;
        verifier = verifier_;
        actors.push(address(0xA11CE));
        actors.push(address(0xB0B));
        actors.push(address(0xCAFE));
    }

    function create(uint96 collateral, uint96 xrpAmount) external {
        collateral = uint96(bound(collateral, 1, 1e24));
        xrpAmount = uint96(bound(xrpAmount, 1, 1e18));
        address actor = actors[nonce % actors.length];
        token.mint(actor, collateral);
        vm.startPrank(actor);
        token.approve(address(escrow), collateral);
        uint64 deadline = uint64(block.timestamp + 1 days);
        escrow.createCommitment(
            actors[(nonce + 1) % actors.length],
            keccak256("destination"),
            xrpAmount,
            collateral,
            100,
            120,
            deadline
        );
        nonce++;
        vm.stopPrank();
    }

    function settlePaid(uint256 seed) external {
        uint256 count = escrow.nextCommitmentId();
        if (count == 0) return;
        uint256 id = seed % count;
        CovenantEscrow.Commitment memory commitment = escrow.getCommitment(id);
        if (commitment.status != CovenantEscrow.Status.Active) return;
        IPayment.Proof memory proof;
        proof.data.attestationType = bytes32("Payment");
        proof.data.sourceId = bytes32("testXRP");
        proof.data.lowestUsedTimestamp = commitment.deadlineTimestamp;
        proof.data.requestBody.transactionId = keccak256(abi.encode(id));
        proof.data.responseBody.blockNumber = commitment.deadlineLedger;
        proof.data.responseBody.blockTimestamp = commitment.deadlineTimestamp;
        proof.data.responseBody.receivingAddressHash = commitment.xrplDestinationHash;
        proof.data.responseBody.intendedReceivingAddressHash = commitment.xrplDestinationHash;
        proof.data.responseBody.receivedAmount = int256(commitment.xrpAmountDrops);
        proof.data.responseBody.intendedReceivedAmount = int256(commitment.xrpAmountDrops);
        proof.data.responseBody.standardPaymentReference = commitment.paymentReference;
        proof.data.responseBody.oneToOne = true;
        escrow.settlePaid(id, proof);
        _assertTerminalAndReplaySafe(id, CovenantEscrow.Status.Fulfilled, proof);
    }

    function settleDefault(uint256 seed) external {
        uint256 count = escrow.nextCommitmentId();
        if (count == 0) return;
        uint256 id = seed % count;
        CovenantEscrow.Commitment memory commitment = escrow.getCommitment(id);
        if (commitment.status != CovenantEscrow.Status.Active) return;
        vm.warp(commitment.deadlineTimestamp + 1);
        IReferencedPaymentNonexistence.Proof memory proof;
        proof.data.attestationType = bytes32("ReferencedPaymentNonexistence");
        proof.data.sourceId = bytes32("testXRP");
        proof.data.lowestUsedTimestamp = commitment.deadlineTimestamp - 1;
        proof.data.requestBody = IReferencedPaymentNonexistence.RequestBody({
            minimalBlockNumber: commitment.minimalLedger,
            deadlineBlockNumber: commitment.deadlineLedger,
            deadlineTimestamp: commitment.deadlineTimestamp,
            destinationAddressHash: commitment.xrplDestinationHash,
            amount: commitment.xrpAmountDrops - 1,
            standardPaymentReference: commitment.paymentReference,
            checkSourceAddresses: false,
            sourceAddressesRoot: bytes32(0)
        });
        proof.data.responseBody = IReferencedPaymentNonexistence.ResponseBody({
            minimalBlockTimestamp: commitment.deadlineTimestamp - 1,
            firstOverflowBlockNumber: commitment.deadlineLedger + 1,
            firstOverflowBlockTimestamp: commitment.deadlineTimestamp + 1
        });
        escrow.settleDefault(id, proof);
        if (escrow.getCommitment(id).status != CovenantEscrow.Status.Defaulted) {
            terminalStateViolation = true;
        }
        try escrow.settleDefault(id, proof) {
            terminalStateViolation = true;
        } catch {}
        if (escrow.getCommitment(id).status != CovenantEscrow.Status.Defaulted) {
            terminalStateViolation = true;
        }
    }

    function failedVerifierCall(uint256 seed) external {
        uint256 count = escrow.nextCommitmentId();
        if (count == 0) return;
        uint256 id = seed % count;
        CovenantEscrow.Commitment memory commitment = escrow.getCommitment(id);
        if (commitment.status != CovenantEscrow.Status.Active) return;
        verifier.setPaymentValid(false);
        IPayment.Proof memory proof;
        proof.data.attestationType = bytes32("Payment");
        proof.data.sourceId = bytes32("testXRP");
        proof.data.lowestUsedTimestamp = commitment.deadlineTimestamp;
        proof.data.requestBody.transactionId = bytes32(uint256(1));
        proof.data.responseBody.blockNumber = commitment.minimalLedger;
        proof.data.responseBody.blockTimestamp = commitment.deadlineTimestamp;
        proof.data.responseBody.receivingAddressHash = commitment.xrplDestinationHash;
        proof.data.responseBody.intendedReceivingAddressHash = commitment.xrplDestinationHash;
        proof.data.responseBody.receivedAmount = int256(commitment.xrpAmountDrops);
        proof.data.responseBody.intendedReceivedAmount = int256(commitment.xrpAmountDrops);
        proof.data.responseBody.standardPaymentReference = commitment.paymentReference;
        proof.data.responseBody.oneToOne = true;
        try escrow.settlePaid(id, proof) {} catch {}
        verifier.setPaymentValid(true);
    }

    function donate(uint96 amount) external {
        amount = uint96(bound(amount, 1, 1e18));
        token.mint(address(escrow), amount);
    }

    function _assertTerminalAndReplaySafe(
        uint256 id,
        CovenantEscrow.Status expected,
        IPayment.Proof memory proof
    ) private {
        if (escrow.getCommitment(id).status != expected) {
            terminalStateViolation = true;
        }
        try escrow.settlePaid(id, proof) {
            terminalStateViolation = true;
        } catch {}
        if (escrow.getCommitment(id).status != expected) terminalStateViolation = true;
    }
}

contract CovenantEscrowInvariantTest is StdInvariant, Test {
    MockToken private token;
    CovenantEscrow private escrow;
    EscrowHandler private handler;

    function setUp() public {
        token = new MockToken();
        MockFdcVerification verifier = new MockFdcVerification();
        escrow = new CovenantEscrow(token, IFdcVerification(address(verifier)));
        handler = new EscrowHandler(escrow, token, verifier);
        targetContract(address(handler));
    }

    function invariantCollateralAlwaysCoversActiveCommitments() public view {
        assertGe(token.balanceOf(address(escrow)), escrow.totalActiveCollateral());
    }

    function invariantTerminalStatesCannotBeReplayedOrChanged() public view {
        assertFalse(handler.terminalStateViolation());
    }
}
