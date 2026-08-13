// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IPayment} from "flare-periphery/src/coston2/IPayment.sol";
import {
    IReferencedPaymentNonexistence
} from "flare-periphery/src/coston2/IReferencedPaymentNonexistence.sol";

contract MockFdcVerification {
    bool public paymentValid = true;
    bool public rpnValid = true;
    bool public observedPaymentExists;
    bytes32 public observedDestination;
    bytes32 public observedReference;
    uint256 public observedAmount;

    function setPaymentValid(bool valid) external {
        paymentValid = valid;
    }

    function setRpnValid(bool valid) external {
        rpnValid = valid;
    }

    /// @dev Models the official XRPL RPN predicate: a payment matches only when its
    /// amount is strictly greater than the RPN request amount.
    function setObservedPayment(
        bool exists,
        bytes32 destination,
        bytes32 paymentReference,
        uint256 amount
    ) external {
        observedPaymentExists = exists;
        observedDestination = destination;
        observedReference = paymentReference;
        observedAmount = amount;
    }

    function verifyPayment(IPayment.Proof calldata proof) external view returns (bool) {
        IPayment.Response calldata data = proof.data;
        IPayment.ResponseBody calldata body = data.responseBody;
        return paymentValid && data.attestationType == bytes32("Payment")
            && data.sourceId == bytes32("testXRP") && data.requestBody.transactionId != bytes32(0)
            && data.requestBody.inUtxo == 0 && data.requestBody.utxo == 0
            && data.lowestUsedTimestamp == body.blockTimestamp && body.status <= 2
            && body.standardPaymentReference != bytes32(0);
    }

    function verifyReferencedPaymentNonexistence(
        IReferencedPaymentNonexistence.Proof calldata proof
    ) external view returns (bool) {
        if (!rpnValid) return false;
        IReferencedPaymentNonexistence.Response calldata data = proof.data;
        IReferencedPaymentNonexistence.RequestBody calldata request = proof.data.requestBody;
        if (
            data.attestationType != bytes32("ReferencedPaymentNonexistence")
                || data.sourceId != bytes32("testXRP")
                || request.standardPaymentReference == bytes32(0)
                || request.minimalBlockNumber > request.deadlineBlockNumber
                || data.lowestUsedTimestamp != data.responseBody.minimalBlockTimestamp
                || data.responseBody.firstOverflowBlockNumber <= request.deadlineBlockNumber
                || data.responseBody.firstOverflowBlockTimestamp <= request.deadlineTimestamp
        ) return false;
        bool matchingPaymentExists = observedPaymentExists
            && observedDestination == request.destinationAddressHash
            && observedReference == request.standardPaymentReference
            && observedAmount > request.amount;
        return !matchingPaymentExists;
    }
}
