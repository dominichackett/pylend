import { NextRequest, NextResponse } from 'next/server';
import { Buffer } from 'buffer';
import axios from 'axios';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const priceFeedId = searchParams.get('priceFeedId');

    if (!priceFeedId) {
      return NextResponse.json({ error: 'priceFeedId is required' }, { status: 400 });
    }

    const HERMES_API = "https://hermes.pyth.network";
    const hermesUrl = `${HERMES_API}/api/latest_vaas?ids[]=${priceFeedId}`;

    const response = await axios.get(hermesUrl);

    if (!response.data || response.data.length === 0) {
      throw new Error("Failed to get Pyth price update data from Hermes.");
    }

    const priceUpdateData = response.data.map((base64String: string) => {
      const buffer = Buffer.from(base64String, 'base64');
      return `0x${buffer.toString('hex')}`;
    });

    return NextResponse.json({ priceUpdateData });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
