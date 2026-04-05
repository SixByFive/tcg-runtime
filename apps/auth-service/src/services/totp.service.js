import speakeasy from 'speakeasy';
import qrcode from 'qrcode';

export function generateTotpSecret(username) {
  const secret = speakeasy.generateSecret({
    name: `SixByFive (${username})`,
    issuer: 'SixByFive',
    length: 20,
  });
  return { base32: secret.base32, otpauthUrl: secret.otpauth_url };
}

export async function generateQrCode(otpauthUrl) {
  return qrcode.toDataURL(otpauthUrl);
}

export function verifyTotp(secret, token) {
  return speakeasy.totp.verify({ secret, encoding: 'base32', token, window: 1 });
}
