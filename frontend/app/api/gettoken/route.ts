import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, Address } from 'viem';
import { sepolia } from 'viem/chains';

// ERC20 ABI for fetching symbol
const ERC20_ABI = [
  {
    "inputs": [],
    "name": "symbol",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

export async function GET(req: NextRequest) {
  try {
    const graphqlQuery = {
      query: `
        query MyQuery {
          LendingPool_CollateralAdded {
            id
            priceFeedId
            threshold
            token
          }
        }
      `,
    };

    const graphqlResponse = await fetch('http://localhost:8080/v1/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(graphqlQuery),
    });

    if (!graphqlResponse.ok) {
      const errorText = await graphqlResponse.text();
      throw new Error(`GraphQL request failed: ${graphqlResponse.status} ${graphqlResponse.statusText} - ${errorText}`);
    }

    const graphqlData = await graphqlResponse.json();
    const collateralAddedEvents = graphqlData.data.LendingPool_CollateralAdded || [];

    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
    });

    const tokensWithSymbols = await Promise.all(
      collateralAddedEvents.map(async (event: any) => {
        const tokenAddress = event.token as Address;
        let symbol = "Unknown";

        try {
          symbol = await publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: "symbol",
          });
        } catch (erc20Error) {
          console.warn(`Could not fetch symbol for token ${tokenAddress}:`, erc20Error);
        }

        return {
          token: tokenAddress,
          symbol: symbol,
          threshold: event.threshold,
        };
      })
    );

    return NextResponse.json(tokensWithSymbols);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
