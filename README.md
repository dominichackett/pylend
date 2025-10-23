# Pylend

Pylend is a decentralized lending protocol built on the Ethereum blockchain. It allows users to supply assets to a lending pool to earn interest, and to borrow PYUSD by providing collateral.

## Architecture

The Pylend protocol consists of two main components:

*   **Smart Contracts:** A set of Solidity smart contracts that implement the core logic of the lending protocol. These contracts are deployed on the Sepolia test network.
*   **Frontend:** A Next.js application that provides a user interface for interacting with the Pylend protocol. The frontend uses `viem` for smart contract interactions and the Pyth Network for real-time price feeds.

## Data Flow

The frontend fetches data from the blockchain in two ways:

1.  **Direct Smart Contract Calls:** For real-time, state-changing operations and for data that is not indexed, the frontend makes direct calls to the smart contracts using `viem`.
2.  **Indexed Data via GraphQL:** For historical data and data that is more efficiently queried when indexed, the frontend uses a GraphQL API. This API is powered by an indexer (such as The Graph) that listens for events emitted by the smart contracts and stores them in a queryable database.