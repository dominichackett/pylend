import { expect } from "chai";
import { describe, it } from "node:test";

describe("Simple test", function () {
  it("Should pass", function () {
    console.log("Simple test running");
    expect(true).to.be.true;
  });
});
