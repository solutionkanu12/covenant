// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Counter} from "../src/Counter.sol";

contract CounterTest {
    Counter private counter;

    function setUp() public {
        counter = new Counter();
    }

    function testIncrement() public {
        counter.increment();
        require(counter.number() == 1, "counter did not increment");
    }

    function testSetNumber() public {
        counter.setNumber(42);
        require(counter.number() == 42, "counter stored the wrong value");
    }
}
