import { HermesClient, Price } from "@pythnetwork/hermes-client";

export async function GET(request: Request) {
  const connection = new HermesClient("https://hermes.pyth.network");

  const priceIds = [
    "0xca80ba6dc32e08d06f1aa886011eed1d77c77be9eb761cc10d72b7d0a2fd57a6", // ETH/USD price id on Pyth
    "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43", // BTC/USD price id on Pyth
  ];

  try {
    const prices: Price[] = await connection.getLatestPriceFeeds(priceIds);

    // Create a new object to store the mapped prices
    const priceMap: { [key: string]: number } = {};

    // Map price IDs to their corresponding prices
    prices.forEach((price) => {
      const priceId = `0x${price.id}`;
      const priceValue = price.getPriceAsNumberUnchecked();
      priceMap[priceId] = priceValue;
    });

    return new Response(JSON.stringify(priceMap), {
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("Pyth price feed error:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch prices" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
