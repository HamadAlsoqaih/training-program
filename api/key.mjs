// The public key the phone needs to sign up for notifications.
// Empty while the server is not set up yet.
import { json, ready, publicKey } from './_lib.mjs';

export function GET() { return json({ key: ready() ? publicKey() : '' }); }
