import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: Request) {
  const { folder, transformation } = await request
    .json()
    .catch(() => ({ folder: 'students', transformation: undefined }));

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json(
      { error: 'Cloudinary environment variables are missing.' },
      { status: 500 }
    );
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folderValue = typeof folder === 'string' && folder.trim() ? folder.trim() : 'students';
  const transformValue =
    typeof transformation === 'string' && transformation.trim() ? transformation.trim() : undefined;

  const params: Array<[string, string]> = [
    ['folder', folderValue],
    ['timestamp', String(timestamp)],
  ];

  if (transformValue) {
    params.push(['transformation', transformValue]);
  }

  const signatureBase =
    params
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('&') + apiSecret;
  const signature = crypto.createHash('sha1').update(signatureBase).digest('hex');

  return NextResponse.json({
    signature,
    timestamp,
    apiKey,
    cloudName,
    folder: folderValue,
    transformation: transformValue,
  });
}
