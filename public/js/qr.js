import qrcode from '../vendor/qrcode.js';

/** A QR code for `text` as an inline SVG string (dark modules on a transparent background). */
export function qrSvg(text) {
  const qr = qrcode(0, 'M'); // type 0 = pick the smallest version that fits
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 1, margin: 2, scalable: true });
}
