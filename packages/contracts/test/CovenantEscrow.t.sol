// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {CovenantEscrow} from "../src/CovenantEscrow.sol";
import {IFdcVerification} from "flare-periphery/src/coston2/IFdcVerification.sol";
import {IPayment} from "flare-periphery/src/coston2/IPayment.sol";
import {
    IReferencedPaymentNonexistence
} from "flare-periphery/src/coston2/IReferencedPaymentNonexistence.sol";
import {MockFdcVerification} from "./mocks/MockFdcVerification.sol";
import {
    DishonestToken,
    FeeOnTransferToken,
    MockToken,
    NegativeRebaseToken
} from "./mocks/MockToken.sol";

contract CovenantEscrowTest is Test {
    MockToken private token;
    MockFdcVerification private verifier;
    CovenantEscrow private escrow;

    address private constant PAYER = address(0xA11CE);
    address private constant BENEFICIARY = address(0xB0B);
    bytes32 private constant DESTINATION = keccak256("xrpl-destination");
    uint256 private constant XRP_AMOUNT = 1_000_000;
    uint256 private constant COLLATERAL = 250_000;
    uint64 private constant MIN_LEDGER = 100;
    uint64 private constant DEADLINE_LEDGER = 120;
    uint64 private deadline;
    bytes32 private REFERENCE;

    function setUp() public {
        token = new MockToken();
        verifier = new MockFdcVerification();
        escrow = new CovenantEscrow(token, IFdcVerification(address(verifier)));
        deadline = uint64(block.timestamp + 1 days);
        token.mint(PAYER, type(uint128).max);
        vm.prank(PAYER);
        token.approve(address(escrow), type(uint256).max);
    }

    function testCreateCommitmentEscrowsCollateralAndStoresTerms() public {
        uint256 id = _create(COLLATERAL);
        CovenantEscrow.Commitment memory commitment = escrow.getCommitment(id);
        assertEq(commitment.payer, PAYER);
        assertEq(commitment.beneficiary, BENEFICIARY);
        assertEq(commitment.xrplDestinationHash, DESTINATION);
        assertEq(commitment.xrpAmountDrops, XRP_AMOUNT);
        assertEq(commitment.collateralAmount, COLLATERAL);
        assertEq(commitment.minimalLedger, MIN_LEDGER);
        assertEq(commitment.deadlineLedger, DEADLINE_LEDGER);
        assertEq(commitment.deadlineTimestamp, deadline);
        assertEq(commitment.paymentReference, _expectedReference(PAYER, id));
        assertEq(uint8(commitment.status), uint8(CovenantEscrow.Status.Active));
        assertEq(token.balanceOf(address(escrow)), COLLATERAL);
        assertEq(escrow.totalActiveCollateral(), COLLATERAL);
        assertTrue(escrow.referenceUsed(commitment.paymentReference));
    }

    function testFrontRunnerCannotBlockOrCopyVictimReference() public {
        address attacker = address(0xBAD);
        token.mint(attacker, COLLATERAL);
        vm.prank(attacker);
        token.approve(address(escrow), COLLATERAL);
        vm.prank(attacker);
        (uint256 attackerId, bytes32 attackerReference) = escrow.createCommitment(
            BENEFICIARY, DESTINATION, XRP_AMOUNT, COLLATERAL, MIN_LEDGER, DEADLINE_LEDGER, deadline
        );
        vm.prank(PAYER);
        (uint256 victimId, bytes32 victimReference) = escrow.createCommitment(
            BENEFICIARY, DESTINATION, XRP_AMOUNT, COLLATERAL, MIN_LEDGER, DEADLINE_LEDGER, deadline
        );
        assertEq(attackerReference, _expectedReference(attacker, attackerId));
        assertEq(victimReference, _expectedReference(PAYER, victimId));
        assertNotEq(attackerReference, victimReference);
    }

    function testMultipleCommitmentsHaveUniqueReferencesForSamePayerAndActors() public {
        uint256 first = _create(COLLATERAL);
        uint256 second = _create(COLLATERAL);
        assertNotEq(
            escrow.getCommitment(first).paymentReference,
            escrow.getCommitment(second).paymentReference
        );
        assertNotEq(
            escrow.getCommitment(first).paymentReference, _expectedReference(BENEFICIARY, first)
        );
    }

    function testConstructorRejectsZeroAddresses() public {
        vm.expectRevert(CovenantEscrow.ZeroAddress.selector);
        new CovenantEscrow(token, IFdcVerification(address(0)));
        vm.expectRevert(CovenantEscrow.ZeroAddress.selector);
        new CovenantEscrow(MockToken(address(0)), IFdcVerification(address(verifier)));
    }

    function testConstructorRejectsAddressesWithoutCode() public {
        vm.expectRevert(CovenantEscrow.AddressHasNoCode.selector);
        new CovenantEscrow(MockToken(address(0x1234)), IFdcVerification(address(verifier)));
        vm.expectRevert(CovenantEscrow.AddressHasNoCode.selector);
        new CovenantEscrow(token, IFdcVerification(address(0x1234)));
    }

    function testCreateRejectsInvalidInputs() public {
        vm.startPrank(PAYER);
        vm.expectRevert(CovenantEscrow.ZeroAddress.selector);
        escrow.createCommitment(
            address(0), DESTINATION, XRP_AMOUNT, COLLATERAL, MIN_LEDGER, DEADLINE_LEDGER, deadline
        );
        vm.expectRevert(CovenantEscrow.ZeroAddress.selector);
        escrow.createCommitment(
            BENEFICIARY, bytes32(0), XRP_AMOUNT, COLLATERAL, MIN_LEDGER, DEADLINE_LEDGER, deadline
        );
        vm.expectRevert(CovenantEscrow.ZeroAmount.selector);
        escrow.createCommitment(
            BENEFICIARY, DESTINATION, 0, COLLATERAL, MIN_LEDGER, DEADLINE_LEDGER, deadline
        );
        vm.expectRevert(CovenantEscrow.ZeroAmount.selector);
        escrow.createCommitment(
            BENEFICIARY, DESTINATION, XRP_AMOUNT, 0, MIN_LEDGER, DEADLINE_LEDGER, deadline
        );
        vm.expectRevert(CovenantEscrow.InvalidLedgerRange.selector);
        escrow.createCommitment(
            BENEFICIARY, DESTINATION, XRP_AMOUNT, COLLATERAL, DEADLINE_LEDGER, MIN_LEDGER, deadline
        );
        vm.expectRevert(CovenantEscrow.DeadlineNotFuture.selector);
        escrow.createCommitment(
            BENEFICIARY,
            DESTINATION,
            XRP_AMOUNT,
            COLLATERAL,
            MIN_LEDGER,
            DEADLINE_LEDGER,
            uint64(block.timestamp)
        );
        vm.stopPrank();
    }

    function testCreateRejectsImpossibleDeadlineBoundaries() public {
        vm.startPrank(PAYER);
        vm.expectRevert(CovenantEscrow.InvalidDeadlineBoundary.selector);
        escrow.createCommitment(
            BENEFICIARY, DESTINATION, XRP_AMOUNT, COLLATERAL, MIN_LEDGER, type(uint64).max, deadline
        );
        vm.expectRevert(CovenantEscrow.InvalidDeadlineBoundary.selector);
        escrow.createCommitment(
            BENEFICIARY,
            DESTINATION,
            XRP_AMOUNT,
            COLLATERAL,
            MIN_LEDGER,
            DEADLINE_LEDGER,
            type(uint64).max
        );
        vm.stopPrank();
    }

    function testAcceptsMaximumUsableDeadlineBoundaries() public {
        vm.prank(PAYER);
        (uint256 id,) = escrow.createCommitment(
            BENEFICIARY,
            DESTINATION,
            XRP_AMOUNT,
            COLLATERAL,
            type(uint64).max - 1,
            type(uint64).max - 1,
            type(uint64).max - 1
        );
        assertEq(escrow.getCommitment(id).deadlineLedger, type(uint64).max - 1);
    }

    function testRejectsFeeOnTransferCollateralOnEntry() public {
        FeeOnTransferToken feeToken = new FeeOnTransferToken();
        CovenantEscrow feeEscrow = new CovenantEscrow(feeToken, IFdcVerification(address(verifier)));
        feeToken.mint(PAYER, COLLATERAL);
        vm.startPrank(PAYER);
        feeToken.approve(address(feeEscrow), COLLATERAL);
        vm.expectRevert(CovenantEscrow.UnexpectedTokenBalanceDelta.selector);
        feeEscrow.createCommitment(
            BENEFICIARY, DESTINATION, XRP_AMOUNT, COLLATERAL, MIN_LEDGER, DEADLINE_LEDGER, deadline
        );
        vm.stopPrank();
        assertEq(feeToken.balanceOf(address(feeEscrow)), 0);
        assertEq(feeEscrow.totalActiveCollateral(), 0);
    }

    function testRejectsFeeOnTransferCollateralOnExitAndRollsBackSettlement() public {
        FeeOnTransferToken feeToken = new FeeOnTransferToken();
        CovenantEscrow feeEscrow = new CovenantEscrow(feeToken, IFdcVerification(address(verifier)));
        feeToken.mint(PAYER, COLLATERAL);
        feeToken.setFeeEnabled(false);
        vm.startPrank(PAYER);
        feeToken.approve(address(feeEscrow), COLLATERAL);
        (uint256 id, bytes32 generatedReference) = feeEscrow.createCommitment(
            BENEFICIARY, DESTINATION, XRP_AMOUNT, COLLATERAL, MIN_LEDGER, DEADLINE_LEDGER, deadline
        );
        REFERENCE = generatedReference;
        vm.stopPrank();
        feeToken.setFeeEnabled(true);
        vm.expectRevert(CovenantEscrow.UnexpectedTokenBalanceDelta.selector);
        feeEscrow.settlePaid(id, _paymentProof());
        assertEq(uint8(feeEscrow.getCommitment(id).status), uint8(CovenantEscrow.Status.Active));
        assertEq(feeEscrow.totalActiveCollateral(), COLLATERAL);
        assertGe(feeToken.balanceOf(address(feeEscrow)), COLLATERAL);
    }

    function testRejectsDishonestCollateralOnEntry() public {
        DishonestToken badToken = new DishonestToken();
        CovenantEscrow badEscrow = new CovenantEscrow(badToken, IFdcVerification(address(verifier)));
        badToken.mint(PAYER, COLLATERAL);
        badToken.setSuppressTransfers(true);
        vm.startPrank(PAYER);
        badToken.approve(address(badEscrow), COLLATERAL);
        vm.expectRevert(CovenantEscrow.UnexpectedTokenBalanceDelta.selector);
        badEscrow.createCommitment(
            BENEFICIARY, DESTINATION, XRP_AMOUNT, COLLATERAL, MIN_LEDGER, DEADLINE_LEDGER, deadline
        );
        vm.stopPrank();
        assertEq(badEscrow.totalActiveCollateral(), 0);
    }

    function testRejectsDishonestCollateralOnExitAndPreservesSolvency() public {
        DishonestToken badToken = new DishonestToken();
        CovenantEscrow badEscrow = new CovenantEscrow(badToken, IFdcVerification(address(verifier)));
        badToken.mint(PAYER, COLLATERAL);
        vm.startPrank(PAYER);
        badToken.approve(address(badEscrow), COLLATERAL);
        (uint256 id, bytes32 generatedReference) = badEscrow.createCommitment(
            BENEFICIARY, DESTINATION, XRP_AMOUNT, COLLATERAL, MIN_LEDGER, DEADLINE_LEDGER, deadline
        );
        REFERENCE = generatedReference;
        vm.stopPrank();
        badToken.setSuppressTransfers(true);
        vm.expectRevert(CovenantEscrow.UnexpectedTokenBalanceDelta.selector);
        badEscrow.settlePaid(id, _paymentProof());
        assertEq(uint8(badEscrow.getCommitment(id).status), uint8(CovenantEscrow.Status.Active));
        assertEq(badEscrow.totalActiveCollateral(), COLLATERAL);
        assertEq(badToken.balanceOf(address(badEscrow)), COLLATERAL);
    }

    function testUnsupportedNegativeRebaseFailsClosedWithoutTheft() public {
        NegativeRebaseToken rebaseToken = new NegativeRebaseToken();
        CovenantEscrow rebaseEscrow =
            new CovenantEscrow(rebaseToken, IFdcVerification(address(verifier)));
        rebaseToken.mint(PAYER, COLLATERAL * 2);
        vm.startPrank(PAYER);
        rebaseToken.approve(address(rebaseEscrow), COLLATERAL * 2);
        (uint256 first, bytes32 firstReference) = rebaseEscrow.createCommitment(
            BENEFICIARY, DESTINATION, XRP_AMOUNT, COLLATERAL, MIN_LEDGER, DEADLINE_LEDGER, deadline
        );
        rebaseEscrow.createCommitment(
            BENEFICIARY, DESTINATION, XRP_AMOUNT, COLLATERAL, MIN_LEDGER, DEADLINE_LEDGER, deadline
        );
        vm.stopPrank();
        rebaseToken.rebaseDown(address(rebaseEscrow), COLLATERAL);
        uint256 payerBefore = rebaseToken.balanceOf(PAYER);
        REFERENCE = firstReference;
        vm.expectRevert(CovenantEscrow.UnexpectedTokenBalanceDelta.selector);
        rebaseEscrow.settlePaid(first, _paymentProof());
        assertEq(rebaseToken.balanceOf(PAYER), payerBefore);
        assertEq(rebaseToken.balanceOf(BENEFICIARY), 0);
        assertEq(rebaseToken.balanceOf(address(rebaseEscrow)), COLLATERAL);
        assertEq(rebaseEscrow.totalActiveCollateral(), COLLATERAL * 2);
        assertEq(
            uint8(rebaseEscrow.getCommitment(first).status), uint8(CovenantEscrow.Status.Active)
        );
    }

    function testPaidSettlementReturnsCollateralToPayer() public {
        uint256 id = _create(REFERENCE, COLLATERAL);
        uint256 beforeBalance = token.balanceOf(PAYER);
        escrow.settlePaid(id, _paymentProof());
        assertEq(token.balanceOf(PAYER), beforeBalance + COLLATERAL);
        assertEq(token.balanceOf(address(escrow)), 0);
        assertEq(escrow.totalActiveCollateral(), 0);
        assertEq(uint8(escrow.getCommitment(id).status), uint8(CovenantEscrow.Status.Fulfilled));
    }

    function testDefaultSettlementPaysBeneficiary() public {
        uint256 id = _create(REFERENCE, COLLATERAL);
        vm.warp(deadline + 1);
        escrow.settleDefault(id, _rpnProof());
        assertEq(token.balanceOf(BENEFICIARY), COLLATERAL);
        assertEq(token.balanceOf(address(escrow)), 0);
        assertEq(escrow.totalActiveCollateral(), 0);
        assertEq(uint8(escrow.getCommitment(id).status), uint8(CovenantEscrow.Status.Defaulted));
    }

    function testExactPaymentAndRpnForNMinusOneCannotBothVerify() public {
        uint256 id = _create(REFERENCE, COLLATERAL);
        verifier.setObservedPayment(true, DESTINATION, REFERENCE, XRP_AMOUNT);

        IPayment.Proof memory paymentProof = _paymentProof();
        assertTrue(verifier.verifyPayment(paymentProof));

        IReferencedPaymentNonexistence.Proof memory rpnProof = _rpnProof();
        assertEq(rpnProof.data.requestBody.amount, XRP_AMOUNT - 1);
        assertFalse(verifier.verifyReferencedPaymentNonexistence(rpnProof));

        vm.warp(deadline + 1);
        vm.expectRevert(CovenantEscrow.InvalidProof.selector);
        escrow.settleDefault(id, rpnProof);
    }

    function testRejectsInvalidVerifierResults() public {
        uint256 paidId = _create(REFERENCE, COLLATERAL);
        verifier.setPaymentValid(false);
        vm.expectRevert(CovenantEscrow.InvalidProof.selector);
        escrow.settlePaid(paidId, _paymentProof());

        uint256 defaultId = _create(keccak256("other"), COLLATERAL);
        verifier.setRpnValid(false);
        vm.warp(deadline + 1);
        IReferencedPaymentNonexistence.Proof memory proof = _rpnProof();
        vm.expectRevert(CovenantEscrow.InvalidProof.selector);
        escrow.settleDefault(defaultId, proof);
    }

    function testRejectsReplayAndDoubleSettlement() public {
        uint256 id = _create(REFERENCE, COLLATERAL);
        escrow.settlePaid(id, _paymentProof());
        vm.expectRevert(CovenantEscrow.CommitmentNotActive.selector);
        escrow.settlePaid(id, _paymentProof());
        vm.warp(deadline + 1);
        vm.expectRevert(CovenantEscrow.CommitmentNotActive.selector);
        escrow.settleDefault(id, _rpnProof());
    }

    function testRejectsUnknownCommitment() public {
        vm.expectRevert(CovenantEscrow.CommitmentNotActive.selector);
        escrow.settlePaid(999, _paymentProof());
    }

    function testRejectsDefaultAtOrBeforeDeadline() public {
        uint256 id = _create(REFERENCE, COLLATERAL);
        vm.warp(deadline);
        vm.expectRevert(CovenantEscrow.DefaultTooEarly.selector);
        escrow.settleDefault(id, _rpnProof());
    }

    function testRejectsEveryMismatchedPaymentField() public {
        uint256 id = _create(REFERENCE, COLLATERAL);
        IPayment.Proof memory proof = _paymentProof();
        proof.data.attestationType = bytes32("wrong");
        _expectPaidMismatch(id, proof);
        proof = _paymentProof();
        proof.data.sourceId = bytes32("XRP");
        vm.expectRevert(CovenantEscrow.UnsupportedSource.selector);
        escrow.settlePaid(id, proof);
        proof = _paymentProof();
        proof.data.requestBody.transactionId = bytes32(0);
        _expectPaidMismatch(id, proof);
        proof = _paymentProof();
        proof.data.requestBody.inUtxo = 1;
        _expectPaidMismatch(id, proof);
        proof = _paymentProof();
        proof.data.requestBody.utxo = 1;
        _expectPaidMismatch(id, proof);
        proof = _paymentProof();
        proof.data.responseBody.status = 1;
        _expectPaidMismatch(id, proof);
        proof = _paymentProof();
        proof.data.responseBody.oneToOne = false;
        _expectPaidMismatch(id, proof);
        proof = _paymentProof();
        proof.data.responseBody.receivingAddressHash = bytes32(uint256(1));
        _expectPaidMismatch(id, proof);
        proof = _paymentProof();
        proof.data.responseBody.intendedReceivingAddressHash = bytes32(uint256(1));
        _expectPaidMismatch(id, proof);
        proof = _paymentProof();
        proof.data.responseBody.receivedAmount = int256(XRP_AMOUNT - 1);
        _expectPaidMismatch(id, proof);
        proof = _paymentProof();
        proof.data.responseBody.intendedReceivedAmount = int256(XRP_AMOUNT - 1);
        _expectPaidMismatch(id, proof);
        proof = _paymentProof();
        proof.data.responseBody.standardPaymentReference = bytes32(uint256(1));
        _expectPaidMismatch(id, proof);
        proof = _paymentProof();
        proof.data.responseBody.blockNumber = MIN_LEDGER - 1;
        _expectPaidMismatch(id, proof);
        proof = _paymentProof();
        proof.data.responseBody.blockNumber = DEADLINE_LEDGER + 1;
        _expectPaidMismatch(id, proof);
        proof = _paymentProof();
        proof.data.responseBody.blockTimestamp = deadline + 1;
        _expectPaidMismatch(id, proof);
    }

    function testRejectsEveryMismatchedRpnField() public {
        uint256 id = _create(REFERENCE, COLLATERAL);
        vm.warp(deadline + 1);
        IReferencedPaymentNonexistence.Proof memory proof = _rpnProof();
        proof.data.attestationType = bytes32("wrong");
        _expectRpnMismatch(id, proof);
        proof = _rpnProof();
        proof.data.sourceId = bytes32("XRP");
        vm.expectRevert(CovenantEscrow.UnsupportedSource.selector);
        escrow.settleDefault(id, proof);
        proof = _rpnProof();
        proof.data.requestBody.minimalBlockNumber++;
        _expectRpnMismatch(id, proof);
        proof = _rpnProof();
        proof.data.requestBody.deadlineBlockNumber++;
        _expectRpnMismatch(id, proof);
        proof = _rpnProof();
        proof.data.requestBody.deadlineTimestamp++;
        _expectRpnMismatch(id, proof);
        proof = _rpnProof();
        proof.data.requestBody.destinationAddressHash = bytes32(uint256(1));
        _expectRpnMismatch(id, proof);
        proof = _rpnProof();
        proof.data.requestBody.amount++;
        _expectRpnMismatch(id, proof);
        proof = _rpnProof();
        proof.data.requestBody.standardPaymentReference = bytes32(uint256(1));
        _expectRpnMismatch(id, proof);
        proof = _rpnProof();
        proof.data.requestBody.checkSourceAddresses = true;
        _expectRpnMismatch(id, proof);
        proof = _rpnProof();
        proof.data.requestBody.sourceAddressesRoot = bytes32(uint256(1));
        _expectRpnMismatch(id, proof);
        proof = _rpnProof();
        proof.data.lowestUsedTimestamp++;
        _expectRpnMismatch(id, proof);
        proof = _rpnProof();
        proof.data.responseBody.firstOverflowBlockNumber = DEADLINE_LEDGER;
        _expectRpnMismatch(id, proof);
        proof = _rpnProof();
        proof.data.responseBody.firstOverflowBlockTimestamp = deadline;
        _expectRpnMismatch(id, proof);
    }

    function testFuzzCollateralConservationOnPaidSettlement(uint128 collateral) public {
        vm.assume(collateral > 0);
        uint256 id = _create(REFERENCE, collateral);
        assertEq(token.balanceOf(address(escrow)), collateral);
        assertEq(escrow.totalActiveCollateral(), collateral);
        escrow.settlePaid(id, _paymentProof());
        assertEq(token.balanceOf(address(escrow)), 0);
        assertEq(escrow.totalActiveCollateral(), 0);
    }

    function testFuzzAcceptsPaymentAtLeastCommitted(uint96 received) public {
        received = uint96(bound(received, XRP_AMOUNT, uint96(type(int96).max)));
        uint256 id = _create(REFERENCE, COLLATERAL);
        IPayment.Proof memory proof = _paymentProof();
        proof.data.responseBody.receivedAmount = int256(uint256(received));
        proof.data.responseBody.intendedReceivedAmount = int256(uint256(received));
        escrow.settlePaid(id, proof);
        assertEq(uint8(escrow.getCommitment(id).status), uint8(CovenantEscrow.Status.Fulfilled));
    }

    function _create(bytes32, uint256 collateral) private returns (uint256 commitmentId) {
        vm.prank(PAYER);
        (commitmentId, REFERENCE) = escrow.createCommitment(
            BENEFICIARY, DESTINATION, XRP_AMOUNT, collateral, MIN_LEDGER, DEADLINE_LEDGER, deadline
        );
    }

    function _create(uint256 collateral) private returns (uint256) {
        return _create(bytes32(0), collateral);
    }

    function _expectedReference(address payer, uint256 commitmentId)
        private
        view
        returns (bytes32)
    {
        return keccak256(
            abi.encode(
                escrow.PAYMENT_REFERENCE_DOMAIN(),
                block.chainid,
                address(escrow),
                payer,
                commitmentId
            )
        );
    }

    function _paymentProof() private view returns (IPayment.Proof memory proof) {
        proof.data.attestationType = bytes32("Payment");
        proof.data.sourceId = bytes32("testXRP");
        proof.data.lowestUsedTimestamp = deadline;
        proof.data.requestBody.transactionId = keccak256("tx");
        proof.data.responseBody.blockNumber = DEADLINE_LEDGER;
        proof.data.responseBody.blockTimestamp = deadline;
        proof.data.responseBody.receivingAddressHash = DESTINATION;
        proof.data.responseBody.intendedReceivingAddressHash = DESTINATION;
        proof.data.responseBody.receivedAmount = int256(XRP_AMOUNT);
        proof.data.responseBody.intendedReceivedAmount = int256(XRP_AMOUNT);
        proof.data.responseBody.standardPaymentReference = REFERENCE;
        proof.data.responseBody.oneToOne = true;
        proof.data.responseBody.status = 0;
    }

    function _rpnProof() private view returns (IReferencedPaymentNonexistence.Proof memory proof) {
        proof.data.attestationType = bytes32("ReferencedPaymentNonexistence");
        proof.data.sourceId = bytes32("testXRP");
        proof.data.lowestUsedTimestamp = deadline - 100;
        proof.data.requestBody = IReferencedPaymentNonexistence.RequestBody({
            minimalBlockNumber: MIN_LEDGER,
            deadlineBlockNumber: DEADLINE_LEDGER,
            deadlineTimestamp: deadline,
            destinationAddressHash: DESTINATION,
            amount: XRP_AMOUNT - 1,
            standardPaymentReference: REFERENCE,
            checkSourceAddresses: false,
            sourceAddressesRoot: bytes32(0)
        });
        proof.data.responseBody = IReferencedPaymentNonexistence.ResponseBody({
            minimalBlockTimestamp: deadline - 100,
            firstOverflowBlockNumber: DEADLINE_LEDGER + 1,
            firstOverflowBlockTimestamp: deadline + 1
        });
    }

    function _expectPaidMismatch(uint256 id, IPayment.Proof memory proof) private {
        vm.expectRevert(CovenantEscrow.ProofFieldMismatch.selector);
        escrow.settlePaid(id, proof);
    }

    function _expectRpnMismatch(uint256 id, IReferencedPaymentNonexistence.Proof memory proof)
        private
    {
        vm.expectRevert(CovenantEscrow.ProofFieldMismatch.selector);
        escrow.settleDefault(id, proof);
    }
}
