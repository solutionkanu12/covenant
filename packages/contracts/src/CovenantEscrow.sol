// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IFdcVerification} from "flare-periphery/src/coston2/IFdcVerification.sol";
import {IPayment} from "flare-periphery/src/coston2/IPayment.sol";
import {
    IReferencedPaymentNonexistence
} from "flare-periphery/src/coston2/IReferencedPaymentNonexistence.sol";

/// @notice Escrows FTestXRP against an XRPL payment commitment.
/// @dev Payment may originate from any XRPL account: receipt of the committed amount at the
/// committed destination with the unique reference satisfies the agreement. The deadline is
/// intentionally hard and has no cure period. Deployments must supply the intended FTestXRP token
/// and the current official FdcVerification contract for their target network. Negative-rebasing
/// and otherwise balance-mutating tokens are unsupported because they can make escrow unavailable.
contract CovenantEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant PAYMENT_ATTESTATION_TYPE = bytes32("Payment");
    bytes32 public constant RPN_ATTESTATION_TYPE = bytes32("ReferencedPaymentNonexistence");
    bytes32 public constant TEST_XRP_SOURCE_ID = bytes32("testXRP");
    bytes32 public constant PAYMENT_REFERENCE_DOMAIN =
        keccak256("CovenantEscrow.paymentReference.v1");

    enum Status {
        None,
        Active,
        Fulfilled,
        Defaulted
    }

    struct Commitment {
        address payer;
        address beneficiary;
        bytes32 xrplDestinationHash;
        uint256 xrpAmountDrops;
        uint256 collateralAmount;
        uint64 minimalLedger;
        uint64 deadlineLedger;
        uint64 deadlineTimestamp;
        bytes32 paymentReference;
        Status status;
    }

    IERC20 public immutable collateralToken;
    IFdcVerification public immutable fdcVerification;
    uint256 public nextCommitmentId;
    uint256 public totalActiveCollateral;

    mapping(uint256 id => Commitment) private _commitments;
    mapping(bytes32 paymentReference => bool) public referenceUsed;

    error ZeroAddress();
    error ZeroAmount();
    error PaymentReferenceCollision();
    error InvalidLedgerRange();
    error DeadlineNotFuture();
    error CommitmentNotActive();
    error InvalidProof();
    error ProofFieldMismatch();
    error DefaultTooEarly();
    error UnsupportedSource();
    error AddressHasNoCode();
    error InvalidDeadlineBoundary();
    error UnexpectedTokenBalanceDelta();

    event CommitmentCreated(
        uint256 indexed commitmentId,
        address indexed payer,
        address indexed beneficiary,
        bytes32 xrplDestinationHash,
        uint256 xrpAmountDrops,
        uint256 collateralAmount,
        uint64 minimalLedger,
        uint64 deadlineLedger,
        uint64 deadlineTimestamp,
        bytes32 paymentReference
    );
    event CommitmentSettled(uint256 indexed commitmentId, Status status, address recipient);

    constructor(IERC20 collateralToken_, IFdcVerification fdcVerification_) {
        if (address(collateralToken_) == address(0) || address(fdcVerification_) == address(0)) {
            revert ZeroAddress();
        }
        if (
            address(collateralToken_).code.length == 0 || address(fdcVerification_).code.length == 0
        ) {
            revert AddressHasNoCode();
        }
        collateralToken = collateralToken_;
        fdcVerification = fdcVerification_;
    }

    function createCommitment(
        address beneficiary,
        bytes32 xrplDestinationHash,
        uint256 xrpAmountDrops,
        uint256 collateralAmount,
        uint64 minimalLedger,
        uint64 deadlineLedger,
        uint64 deadlineTimestamp
    ) external nonReentrant returns (uint256 commitmentId, bytes32 paymentReference) {
        if (
            beneficiary == address(0) || beneficiary == address(this)
                || xrplDestinationHash == bytes32(0)
        ) revert ZeroAddress();
        if (xrpAmountDrops == 0 || collateralAmount == 0) revert ZeroAmount();
        if (minimalLedger > deadlineLedger) revert InvalidLedgerRange();
        if (deadlineLedger == type(uint64).max || deadlineTimestamp == type(uint64).max) {
            revert InvalidDeadlineBoundary();
        }
        if (deadlineTimestamp <= block.timestamp) revert DeadlineNotFuture();

        uint256 balanceBefore = collateralToken.balanceOf(address(this));

        commitmentId = nextCommitmentId++;
        // Flare's standard XRPL payment reference is exactly one 32-byte MemoData value. A
        // keccak256 digest is already exactly 32 bytes; clients must place these bytes unchanged in
        // the transaction's sole Memo. The domain, chain, escrow, payer and monotonic id isolate the
        // namespace and make the reference independent of caller-supplied transaction calldata.
        paymentReference = keccak256(
            abi.encode(
                PAYMENT_REFERENCE_DOMAIN, block.chainid, address(this), msg.sender, commitmentId
            )
        );
        if (paymentReference == bytes32(0) || referenceUsed[paymentReference]) {
            revert PaymentReferenceCollision();
        }
        referenceUsed[paymentReference] = true;
        totalActiveCollateral += collateralAmount;
        _commitments[commitmentId] = Commitment({
            payer: msg.sender,
            beneficiary: beneficiary,
            xrplDestinationHash: xrplDestinationHash,
            xrpAmountDrops: xrpAmountDrops,
            collateralAmount: collateralAmount,
            minimalLedger: minimalLedger,
            deadlineLedger: deadlineLedger,
            deadlineTimestamp: deadlineTimestamp,
            paymentReference: paymentReference,
            status: Status.Active
        });

        emit CommitmentCreated(
            commitmentId,
            msg.sender,
            beneficiary,
            xrplDestinationHash,
            xrpAmountDrops,
            collateralAmount,
            minimalLedger,
            deadlineLedger,
            deadlineTimestamp,
            paymentReference
        );
        collateralToken.safeTransferFrom(msg.sender, address(this), collateralAmount);
        uint256 balanceAfter = collateralToken.balanceOf(address(this));
        if (balanceAfter < balanceBefore || balanceAfter - balanceBefore != collateralAmount) {
            revert UnexpectedTokenBalanceDelta();
        }
    }

    function settlePaid(uint256 commitmentId, IPayment.Proof calldata proof) external nonReentrant {
        Commitment storage commitment = _activeCommitment(commitmentId);
        IPayment.Response calldata data = proof.data;
        if (data.attestationType != PAYMENT_ATTESTATION_TYPE) revert ProofFieldMismatch();
        if (data.sourceId != TEST_XRP_SOURCE_ID) revert UnsupportedSource();
        if (
            data.requestBody.transactionId == bytes32(0) || data.requestBody.inUtxo != 0
                || data.requestBody.utxo != 0
        ) {
            revert ProofFieldMismatch();
        }
        IPayment.ResponseBody calldata body = data.responseBody;
        if (
            body.status != 0 || !body.oneToOne
                || body.receivingAddressHash != commitment.xrplDestinationHash
                || body.intendedReceivingAddressHash != commitment.xrplDestinationHash
                || body.receivedAmount < 0
                || uint256(body.receivedAmount) < commitment.xrpAmountDrops
                || body.intendedReceivedAmount < 0
                || uint256(body.intendedReceivedAmount) < commitment.xrpAmountDrops
                || body.standardPaymentReference != commitment.paymentReference
                || body.blockNumber < commitment.minimalLedger
                || body.blockNumber > commitment.deadlineLedger
                || body.blockTimestamp > commitment.deadlineTimestamp
        ) revert ProofFieldMismatch();
        if (!fdcVerification.verifyPayment(proof)) revert InvalidProof();
        _settle(commitmentId, commitment, Status.Fulfilled, commitment.payer);
    }

    function settleDefault(
        uint256 commitmentId,
        IReferencedPaymentNonexistence.Proof calldata proof
    ) external nonReentrant {
        Commitment storage commitment = _activeCommitment(commitmentId);
        if (block.timestamp <= commitment.deadlineTimestamp) revert DefaultTooEarly();
        IReferencedPaymentNonexistence.Response calldata data = proof.data;
        if (data.attestationType != RPN_ATTESTATION_TYPE) revert ProofFieldMismatch();
        if (data.sourceId != TEST_XRP_SOURCE_ID) revert UnsupportedSource();
        IReferencedPaymentNonexistence.RequestBody calldata request = data.requestBody;
        if (
            request.minimalBlockNumber != commitment.minimalLedger
                || request.deadlineBlockNumber != commitment.deadlineLedger
                || request.deadlineTimestamp != commitment.deadlineTimestamp
                || request.destinationAddressHash != commitment.xrplDestinationHash
                // FDC RPN matches payments strictly greater than request.amount. Using N - 1
                // therefore proves that no payment satisfying the N-drop commitment exists.
                || request.amount != commitment.xrpAmountDrops - 1
                || request.standardPaymentReference != commitment.paymentReference
                || request.checkSourceAddresses || request.sourceAddressesRoot != bytes32(0)
                || data.lowestUsedTimestamp != data.responseBody.minimalBlockTimestamp
                || data.responseBody.firstOverflowBlockNumber <= commitment.deadlineLedger
                || data.responseBody.firstOverflowBlockTimestamp <= commitment.deadlineTimestamp
        ) revert ProofFieldMismatch();
        if (!fdcVerification.verifyReferencedPaymentNonexistence(proof)) revert InvalidProof();
        _settle(commitmentId, commitment, Status.Defaulted, commitment.beneficiary);
    }

    function getCommitment(uint256 commitmentId) external view returns (Commitment memory) {
        return _commitments[commitmentId];
    }

    function _activeCommitment(uint256 commitmentId)
        private
        view
        returns (Commitment storage commitment)
    {
        commitment = _commitments[commitmentId];
        if (commitment.status != Status.Active) revert CommitmentNotActive();
    }

    function _settle(
        uint256 commitmentId,
        Commitment storage commitment,
        Status status,
        address recipient
    ) private {
        uint256 collateralAmount = commitment.collateralAmount;
        uint256 escrowBalanceBefore = collateralToken.balanceOf(address(this));
        uint256 recipientBalanceBefore = collateralToken.balanceOf(recipient);
        commitment.status = status;
        totalActiveCollateral -= collateralAmount;
        emit CommitmentSettled(commitmentId, status, recipient);
        collateralToken.safeTransfer(recipient, collateralAmount);
        uint256 escrowBalanceAfter = collateralToken.balanceOf(address(this));
        uint256 recipientBalanceAfter = collateralToken.balanceOf(recipient);
        if (
            escrowBalanceAfter > escrowBalanceBefore
                || escrowBalanceBefore - escrowBalanceAfter != collateralAmount
                || recipientBalanceAfter < recipientBalanceBefore
                || recipientBalanceAfter - recipientBalanceBefore != collateralAmount
                || escrowBalanceAfter < totalActiveCollateral
        ) revert UnexpectedTokenBalanceDelta();
    }
}
