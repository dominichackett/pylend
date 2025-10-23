
# Frontend Architecture and Data Flow

This document outlines the architecture and data flow of the Pylend frontend application.

## Overview

The frontend is a [Next.js](https://nextjs.org/) application that interacts with the Pylend smart contracts on the Sepolia test network. It uses [Viem](https://viem.sh/) for smart contract interactions and [Pyth Network](https://pyth.network/) for real-time price feeds.

## Data Flow

There are two primary ways the frontend fetches data from the blockchain:

1.  **Direct Smart Contract Calls:** For real-time, state-changing operations and for data that is not indexed, the frontend makes direct calls to the smart contracts using `viem`. An example of this is the `Stats.tsx` component, which fetches aggregate data like total liquidity, total borrowed, etc., directly from the `LendingPool` contract.

2.  **Indexed Data via GraphQL:** For historical data and data that is more efficiently queried when indexed, the frontend uses a GraphQL API. This API is powered by an indexer (such as The Graph) that listens for events emitted by the smart contracts and stores them in a queryable database.

    An example of this is the `markets/page.tsx` component, which fetches the list of approved collateral tokens. The `CollateralAdded` events from the `LendingPool` contract are indexed, and the frontend queries the GraphQL endpoint to get this list. This is a common and recommended pattern for production dApps as it provides a better user experience by avoiding direct, and potentially slow, blockchain queries for large data sets.

## Component Breakdown

*   **`app/markets/page.tsx`**: Displays the available collateral markets. It fetches the list of approved collateral tokens from the `/api/gettoken` API route, which in turn queries the GraphQL endpoint. It also subscribes to real-time price updates from the Pyth Network using the Hermes client.

*   **`app/components/Stats.tsx`**: Displays global statistics about the Pylend protocol. It fetches data directly from the `LendingPool` smart contract using `viem`.

*   **`app/api/gettoken/route.ts`**: A Next.js API route that acts as a proxy to the GraphQL endpoint. It fetches the list of approved collateral tokens and enriches it with token symbols and decimals by making additional calls to the respective ERC20 contracts.

