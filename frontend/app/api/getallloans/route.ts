import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const graphqlQuery = {
      query: `
        query LendingPool_LoanCreated {
          LendingPool_LoanCreated {
            id
            borrowedAmount
            borrower
            collateralAmount
            collateralToken
            interestRate
            loanId
            timestamp
          }
        }
      `,
    };

    const response = await fetch('http://localhost:8080/v1/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(graphqlQuery),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GraphQL request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
